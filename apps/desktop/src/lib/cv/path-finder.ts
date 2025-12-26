/**
 * A* Path Finding on Edge Maps
 *
 * Finds the optimal path between two points following detected edges.
 * Uses A* algorithm with edge map as cost function.
 */

import type { EdgeMap, PathFinderOptions, PixelPoint } from './types'
import { DEFAULT_PATH_OPTIONS } from './types'
import { distance, isInBounds, simplifyPath, smoothPath } from './geometry'

/**
 * Priority queue node for A*
 */
interface AStarNode {
  point: PixelPoint
  g: number // Cost from start
  f: number // g + heuristic
  parent: AStarNode | null
}

/**
 * Create a unique key for a point (for Set/Map operations)
 */
function pointKey(p: PixelPoint): string {
  return `${p.x},${p.y}`
}

/**
 * Get neighbors of a point (8-directional or 4-directional)
 */
function getNeighbors(point: PixelPoint, allowDiagonal: boolean): PixelPoint[] {
  const neighbors: PixelPoint[] = [
    { x: point.x - 1, y: point.y }, // Left
    { x: point.x + 1, y: point.y }, // Right
    { x: point.x, y: point.y - 1 }, // Up
    { x: point.x, y: point.y + 1 }, // Down
  ]

  if (allowDiagonal) {
    neighbors.push(
      { x: point.x - 1, y: point.y - 1 }, // Top-left
      { x: point.x + 1, y: point.y - 1 }, // Top-right
      { x: point.x - 1, y: point.y + 1 }, // Bottom-left
      { x: point.x + 1, y: point.y + 1 }, // Bottom-right
    )
  }

  return neighbors
}

/**
 * Get the cost of moving to a pixel based on edge map
 * Lower cost for edge pixels, higher for non-edge
 */
function getMoveCost(
  edgeMap: EdgeMap,
  to: PixelPoint,
  nonEdgeCost: number,
  isDiagonal: boolean,
): number {
  const index = to.y * edgeMap.width + to.x
  const isEdge = edgeMap.data[index] > 128

  // Base cost (higher for diagonal movement)
  const baseCost = isDiagonal ? Math.SQRT2 : 1

  // Edge pixels have low cost, non-edge have high cost
  return isEdge ? baseCost : baseCost * nonEdgeCost
}

/**
 * Heuristic function for A* (Euclidean distance)
 */
function heuristic(a: PixelPoint, b: PixelPoint): number {
  return distance(a, b)
}

/**
 * Reconstruct path from A* result
 */
function reconstructPath(endNode: AStarNode): PixelPoint[] {
  const path: PixelPoint[] = []
  let current: AStarNode | null = endNode

  while (current !== null) {
    path.unshift(current.point)
    current = current.parent
  }

  return path
}

/**
 * Find optimal path between two points on an edge map using A* algorithm
 *
 * @param edgeMap - Binary edge map from Canny detection
 * @param start - Starting point in pixel coordinates
 * @param end - Ending point in pixel coordinates
 * @param options - Path finding options
 * @returns Array of points forming the path, or empty array if no path found
 */
export function findPath(
  edgeMap: EdgeMap,
  start: PixelPoint,
  end: PixelPoint,
  options: PathFinderOptions = {},
): { path: PixelPoint[]; cost: number } {
  const opts = { ...DEFAULT_PATH_OPTIONS, ...options }

  // Validate inputs
  if (!isInBounds(start, edgeMap.width, edgeMap.height)) {
    console.error('Start point out of bounds')
    return { path: [], cost: Infinity }
  }
  if (!isInBounds(end, edgeMap.width, edgeMap.height)) {
    console.error('End point out of bounds')
    return { path: [], cost: Infinity }
  }

  // Initialize A*
  const openSet: AStarNode[] = []
  const closedSet = new Set<string>()
  const gScores = new Map<string, number>()

  const startNode: AStarNode = {
    point: start,
    g: 0,
    f: heuristic(start, end),
    parent: null,
  }

  openSet.push(startNode)
  gScores.set(pointKey(start), 0)

  let iterations = 0

  while (openSet.length > 0 && iterations < opts.maxIterations) {
    iterations++

    // Find node with lowest f score
    let lowestIndex = 0
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[lowestIndex].f) {
        lowestIndex = i
      }
    }

    const current = openSet[lowestIndex]

    // Check if we reached the goal
    if (current.point.x === end.x && current.point.y === end.y) {
      let path = reconstructPath(current)

      // Apply post-processing
      if (opts.smoothing) {
        path = smoothPath(path, 5)
      }
      if (opts.simplifyTolerance > 0) {
        path = simplifyPath(path, opts.simplifyTolerance)
      }

      return { path, cost: current.g }
    }

    // Move current from open to closed
    openSet.splice(lowestIndex, 1)
    closedSet.add(pointKey(current.point))

    // Explore neighbors
    const neighbors = getNeighbors(current.point, opts.allowDiagonal)

    for (const neighbor of neighbors) {
      // Skip if out of bounds
      if (!isInBounds(neighbor, edgeMap.width, edgeMap.height)) continue

      // Skip if already evaluated
      const neighborKey = pointKey(neighbor)
      if (closedSet.has(neighborKey)) continue

      // Calculate movement cost
      const isDiagonal =
        neighbor.x !== current.point.x && neighbor.y !== current.point.y
      const moveCost = getMoveCost(edgeMap, neighbor, opts.nonEdgeCost, isDiagonal)
      const tentativeG = current.g + moveCost

      // Check if this path is better
      const existingG = gScores.get(neighborKey) ?? Infinity

      if (tentativeG < existingG) {
        // This is a better path
        const neighborNode: AStarNode = {
          point: neighbor,
          g: tentativeG,
          f: tentativeG + heuristic(neighbor, end),
          parent: current,
        }

        gScores.set(neighborKey, tentativeG)

        // Add to open set if not already there
        const existingIndex = openSet.findIndex(
          (n) => n.point.x === neighbor.x && n.point.y === neighbor.y,
        )
        if (existingIndex === -1) {
          openSet.push(neighborNode)
        } else {
          openSet[existingIndex] = neighborNode
        }
      }
    }
  }

  // No path found - return direct line as fallback
  console.warn(`A* did not find path after ${iterations} iterations, using fallback`)
  return { path: [start, end], cost: Infinity }
}

/**
 * Calculate confidence score for a path
 * Returns the percentage of path points that lie on detected edges
 */
export function calculatePathConfidence(path: PixelPoint[], edgeMap: EdgeMap): number {
  if (path.length === 0) return 0

  let edgePoints = 0

  for (const point of path) {
    if (isInBounds(point, edgeMap.width, edgeMap.height)) {
      const index = point.y * edgeMap.width + point.x
      if (edgeMap.data[index] > 128) {
        edgePoints++
      }
    }
  }

  return edgePoints / path.length
}
