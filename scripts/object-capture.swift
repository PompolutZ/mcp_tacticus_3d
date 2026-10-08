// Apple Object Capture (RealityKit photogrammetry): a folder of photos → OBJ, MTL and one color texture.
// photos-to-glb.mjs compiles and runs this file. See docs/feature-custom-models.md.
//
// Usage: object-capture <photos dir> <output dir> <max triangles> <texture size: 1024|2048|4096|8192>

import Foundation
import RealityKit

func fail(_ message: String) -> Never {
  FileHandle.standardError.write(Data("object-capture: \(message)\n".utf8))
  exit(1)
}

// Progress lines appear at once, also when stdout is not a terminal
setvbuf(stdout, nil, _IOLBF, 0)

let textureSizes: [UInt: PhotogrammetrySession.Configuration.CustomDetailSpecification.TextureDimension] = [
  1024: .oneK, 2048: .twoK, 4096: .fourK, 8192: .eightK,
]
let args = CommandLine.arguments
guard args.count == 5, let triangles = UInt(args[3]), let textureSize = UInt(args[4]).flatMap({ textureSizes[$0] }) else {
  fail("usage: object-capture <photos dir> <output dir> <max triangles> <texture size: 1024|2048|4096|8192>")
}
guard PhotogrammetrySession.isSupported else { fail("Object Capture is not supported on this Mac") }

// .custom detail: Object Capture reduces the mesh and the texture itself, so no decimate step is needed.
// Only the color texture, because the app does not use normal, roughness or occlusion maps.
var config = PhotogrammetrySession.Configuration()
config.customDetailSpecification.maximumPolygonCount = triangles
config.customDetailSpecification.maximumTextureDimension = textureSize
config.customDetailSpecification.outputTextureMaps = [.diffuseColor]
config.customDetailSpecification.textureFormat = .png

let input = URL(fileURLWithPath: args[1], isDirectory: true)
// A directory (not a .usdz file) makes Object Capture write OBJ, MTL and PNG
let output = URL(fileURLWithPath: args[2], isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)

let session: PhotogrammetrySession
do {
  session = try PhotogrammetrySession(input: input, configuration: config)
} catch {
  fail("cannot read photos in \(input.path): \(error)")
}
try session.process(requests: [.modelFile(url: output, detail: .custom)])

var lastPercent = -1
for try await message in session.outputs {
  switch message {
  case .requestProgress(_, let fraction):
    // One line per 10 %, so the log stays short
    let percent = Int(fraction * 10) * 10
    if percent != lastPercent {
      lastPercent = percent
      print("\(percent) %")
    }
  case .invalidSample(let id, let reason):
    print("warning: photo \(id) not used: \(reason)")
  case .skippedSample(let id):
    print("warning: photo \(id) skipped")
  case .automaticDownsampling:
    print("warning: not enough memory, photos are downsampled")
  case .stitchingIncomplete:
    print("warning: some photos could not be connected to the others, the model can have holes")
  case .requestError(_, let error):
    fail("\(error)")
  case .processingCancelled:
    fail("cancelled")
  case .processingComplete:
    exit(0)
  default:
    break
  }
}
