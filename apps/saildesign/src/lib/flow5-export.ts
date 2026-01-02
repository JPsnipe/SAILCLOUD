import type { SailDefinition, RigDefinition } from './sail-geometry'
import { interpolateProfile, generateSailMesh } from './sail-geometry'

/**
 * Generate just the <SplineSail> section for a definition
 * 
 * Flow5 coordinate system:
 * - Each sail's <Position> tag defines its origin (tack point)
 * - Section positions are RELATIVE to that sail origin
 * - X = aft (positive towards stern), Y = starboard, Z = up
 */
function generateSplineSailXml(sail: SailDefinition, rig: RigDefinition): string {
    const isMain = sail.type === 'main'
    const rakeRad = (rig.rakeDeg * Math.PI) / 180
    const sheetRad = ((isMain ? rig.mainSheetAngle : rig.jibSheetAngle) * Math.PI) / 180
    const zBase = rig.sheerAboveWaterline

    const sectionsCount = Math.max(sail.profiles.length, 11)

    // Calculate sail origin (tack position) - this is the sail's <Position>
    let sailOriginX: number
    let sailOriginY: number
    let sailOriginZ: number

    if (isMain) {
        // Main sail tack is at the mast foot + boom height
        sailOriginX = 0
        sailOriginY = 0
        sailOriginZ = zBase + rig.boomAboveSheer
    } else {
        // Jib tack is at the bow
        sailOriginX = -rig.jPosition
        sailOriginY = 0
        sailOriginZ = zBase + rig.jibTackHeight
    }

    let xml = '    <SplineSail>\n'
    xml += `        <Name>${sail.name}</Name>\n`
    xml += '        <Description>Exported from SailDesign</Description>\n'
    // Sail origin at tack point
    xml += `        <Position>${sailOriginX.toFixed(4)}, ${sailOriginY.toFixed(4)}, ${sailOriginZ.toFixed(4)}</Position>\n`

    const refArea = sail.luffLength * sail.footLength * 0.5
    const refChord = sail.footLength
    xml += `        <Reference_area>${refArea.toFixed(4)}</Reference_area>\n`
    xml += `        <Reference_chord>${refChord.toFixed(4)}</Reference_chord>\n`
    xml += '        <Type>CUBICSPLINE</Type>\n'

    xml += '        <x_panels>25</x_panels>\n'
    xml += '        <x_panel_distribution>COSINE</x_panel_distribution>\n'
    xml += '        <z_panels>25</z_panels>\n'
    xml += '        <z_panel_distribution>COSINE</z_panel_distribution>\n'

    for (let i = 0; i < sectionsCount; i++) {
        const girth = i / (sectionsCount - 1)
        const profile = interpolateProfile(sail.profiles, girth)

        // Section positions are RELATIVE to the sail's origin (tack)
        let secX = 0
        let secY = 0
        let secZ = 0

        if (isMain) {
            // Main sections go up the mast with rake
            const heightAboveTack = girth * sail.luffLength
            secX = Math.sin(rakeRad) * heightAboveTack  // Aft offset due to rake
            secY = 0
            secZ = Math.cos(rakeRad) * heightAboveTack  // Vertical height
        } else {
            // Jib sections follow the forestay from tack to head
            // Match the geometry used in generateSailMesh
            // Tack is at sail origin (0,0,0 relative to sail, which is at -jPosition absolute)
            // Head is at the mast at jibHalyardHeight

            // Vertical span from tack to head
            const tackHeightAbs = rig.sheerAboveWaterline + rig.jibTackHeight
            const headHeightAbs = rig.sheerAboveWaterline + rig.jibHalyardHeight
            const verticalSpan = headHeightAbs - tackHeightAbs

            // Head position relative to tack:
            // - jPosition to reach the mast (from sail origin at -jPosition)
            // - Plus rake offset: the mast at jibHalyardHeight is offset by sin(rake) * jibHalyardHeight
            const headXRel = rig.jPosition + rig.jibHalyardHeight * Math.sin(rakeRad)
            const headZRel = verticalSpan

            // Interpolate linearly along the forestay
            secX = girth * headXRel
            secZ = girth * headZRel
            secY = 4 * rig.jibSag * girth * (1 - girth)  // Sag to leeward
        }

        xml += '        <Section>\n'
        xml += `            <Position>${secX.toFixed(4)}, ${secY.toFixed(4)}, ${secZ.toFixed(4)}</Position>\n`
        xml += '            <Ry>0.00</Ry>\n'

        // Pre-apply Twist and Sheet Angle to point coordinates
        const totalTwistRad = (profile.twist * Math.PI) / 180 + sheetRad
        const cosT = Math.cos(totalTwistRad)
        const sinT = Math.sin(totalTwistRad)

        const chordLength = profile.chord * sail.footLength
        const numPoints = 25

        for (let j = 0; j < numPoints; j++) {
            const chordFrac = j / (numPoints - 1)
            const camberHeight = profile.camber * chordLength
            const camberPos = profile.camberPos ?? 0.4
            const entryAngleRad = ((profile.entryAngle ?? 30) * Math.PI) / 180
            const exitAngleRad = ((profile.exitAngle ?? 5) * Math.PI) / 180

            let y = 0
            if (chordFrac <= camberPos) {
                const t = chordFrac / camberPos
                y = (t * t * t - 2 * t * t + t) * (Math.tan(entryAngleRad) * camberPos * chordLength) +
                    (-2 * t * t * t + 3 * t * t) * camberHeight
            } else {
                const t = (chordFrac - camberPos) / (1 - camberPos)
                y = (2 * t * t * t - 3 * t * t + 1) * camberHeight +
                    (t * t * t - t * t) * (-Math.tan(exitAngleRad) * (1 - camberPos) * chordLength)
            }

            const x = chordFrac * chordLength
            // 2D Rotation (Twist) around LE (0,0)
            const rotX = x * cosT - y * sinT
            const rotY = x * sinT + y * cosT

            xml += `            <point>${rotX.toFixed(5)}, ${rotY.toFixed(5)}, 1.00000</point>\n`
        }

        xml += '        </Section>\n'
    }

    xml += '    </SplineSail>\n'
    return xml
}



/**
 * Export one or both sails to Flow5 XML format
 * Supports both Single Sail (xflsail) and Full Project (xflboat) formats
 */
export function exportToFlow5Xml(sails: (SailDefinition | null)[], rig: RigDefinition): string {
    const activeSails = sails.filter(s => s !== null) as SailDefinition[]
    const isMulti = activeSails.length > 1

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    // Removing DOCTYPE as it might cause issues with some versions if not exactly as expected
    // xml += '<!DOCTYPE flow5>\n'

    if (isMulti) {
        xml += '<xflboat version="1.0">\n'
    } else {
        xml += '<xflsail version="1.0">\n'
    }

    // Standardizing on 'Units' (uppercase) as seen in Flow5 writer
    xml += '    <Units>\n'
    xml += '        <meter_to_length_unit>1.0</meter_to_length_unit>\n'
    xml += '        <m2_to_area_unit>1.0</m2_to_area_unit>\n'
    xml += '        <kg_to_mass_unit>1.0</kg_to_mass_unit>\n'
    xml += '        <ms_to_speed_unit>1.0</ms_to_speed_unit>\n'
    xml += '        <kgm2_to_inertia_unit>1.0</kgm2_to_inertia_unit>\n'
    xml += '    </Units>\n'

    if (isMulti) {
        xml += '    <Boat>\n'
        xml += '        <Name>SailDesign Project</Name>\n'
        xml += '        <Description>Full rig export from SailDesign</Description>\n'
        for (const sail of activeSails) {
            xml += generateSplineSailXml(sail, rig)
        }
        xml += '    </Boat>\n'
        xml += '</xflboat>\n'
    } else if (activeSails.length === 1) {
        xml += generateSplineSailXml(activeSails[0], rig)
        xml += '</xflsail>\n'
    }

    return xml
}


export function downloadFile(filename: string, content: string, mimeType: string = 'text/xml') {
    const element = document.createElement('a')
    const file = new Blob([content], { type: mimeType })
    element.href = URL.createObjectURL(file)
    element.download = filename
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
}

/**
 * Calculate normal vector for a triangle
 */
function calculateNormal(v1: number[], v2: number[], v3: number[]): number[] {
    const u = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]]
    const v = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]]
    const n = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0]
    ]
    const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2])
    if (len > 0) {
        n[0] /= len
        n[1] /= len
        n[2] /= len
    }
    return n
}

/**
 * Export one or both sails to STL format
 * Uses the same mesh geometry as the 3D visualization
 */
export function exportToStl(sails: (SailDefinition | null)[], rig: RigDefinition): string {
    const activeSails = sails.filter(s => s !== null) as SailDefinition[]

    let stl = 'solid SAILS\n'

    for (const sail of activeSails) {
        const mesh = generateSailMesh(sail, rig, 25, 15)
        const vertices = mesh.vertices
        const indices = mesh.indices

        // Process each triangle
        for (let i = 0; i < indices.length; i += 3) {
            const i1 = indices[i] * 3
            const i2 = indices[i + 1] * 3
            const i3 = indices[i + 2] * 3

            const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]]
            const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]]
            const v3 = [vertices[i3], vertices[i3 + 1], vertices[i3 + 2]]

            const normal = calculateNormal(v1, v2, v3)

            stl += `  facet normal ${normal[0].toExponential(6)} ${normal[1].toExponential(6)} ${normal[2].toExponential(6)}\n`
            stl += '    outer loop\n'
            stl += `      vertex ${v1[0].toExponential(6)} ${v1[1].toExponential(6)} ${v1[2].toExponential(6)}\n`
            stl += `      vertex ${v2[0].toExponential(6)} ${v2[1].toExponential(6)} ${v2[2].toExponential(6)}\n`
            stl += `      vertex ${v3[0].toExponential(6)} ${v3[1].toExponential(6)} ${v3[2].toExponential(6)}\n`
            stl += '    endloop\n'
            stl += '  endfacet\n'
        }
    }

    stl += 'endsolid SAILS\n'
    return stl
}

/**
 * Export to binary STL format (more compact)
 */
export function exportToStlBinary(sails: (SailDefinition | null)[], rig: RigDefinition): ArrayBuffer {
    const activeSails = sails.filter(s => s !== null) as SailDefinition[]

    // First pass: count total triangles
    let totalTriangles = 0
    const meshes: { vertices: Float32Array; indices: Uint32Array }[] = []

    for (const sail of activeSails) {
        const mesh = generateSailMesh(sail, rig, 25, 15)
        meshes.push(mesh)
        totalTriangles += mesh.indices.length / 3
    }

    // Binary STL format:
    // 80 bytes header
    // 4 bytes: number of triangles (uint32)
    // For each triangle:
    //   12 bytes: normal (3 x float32)
    //   36 bytes: vertices (3 x 3 x float32)
    //   2 bytes: attribute byte count (uint16, usually 0)
    const bufferSize = 80 + 4 + totalTriangles * 50
    const buffer = new ArrayBuffer(bufferSize)
    const view = new DataView(buffer)

    // Write header (80 bytes)
    const header = 'SailDesign STL Export'
    for (let i = 0; i < 80; i++) {
        view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0)
    }

    // Write triangle count
    view.setUint32(80, totalTriangles, true)

    let offset = 84
    for (const mesh of meshes) {
        const vertices = mesh.vertices
        const indices = mesh.indices

        for (let i = 0; i < indices.length; i += 3) {
            const i1 = indices[i] * 3
            const i2 = indices[i + 1] * 3
            const i3 = indices[i + 2] * 3

            const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]]
            const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]]
            const v3 = [vertices[i3], vertices[i3 + 1], vertices[i3 + 2]]

            const normal = calculateNormal(v1, v2, v3)

            // Write normal
            view.setFloat32(offset, normal[0], true); offset += 4
            view.setFloat32(offset, normal[1], true); offset += 4
            view.setFloat32(offset, normal[2], true); offset += 4

            // Write vertices
            view.setFloat32(offset, v1[0], true); offset += 4
            view.setFloat32(offset, v1[1], true); offset += 4
            view.setFloat32(offset, v1[2], true); offset += 4

            view.setFloat32(offset, v2[0], true); offset += 4
            view.setFloat32(offset, v2[1], true); offset += 4
            view.setFloat32(offset, v2[2], true); offset += 4

            view.setFloat32(offset, v3[0], true); offset += 4
            view.setFloat32(offset, v3[1], true); offset += 4
            view.setFloat32(offset, v3[2], true); offset += 4

            // Attribute byte count (0)
            view.setUint16(offset, 0, true); offset += 2
        }
    }

    return buffer
}

/**
 * Download binary file
 */
export function downloadBinaryFile(filename: string, content: ArrayBuffer) {
    const element = document.createElement('a')
    const file = new Blob([content], { type: 'application/octet-stream' })
    element.href = URL.createObjectURL(file)
    element.download = filename
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
}
