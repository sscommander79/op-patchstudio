import AppKit
import AVFoundation
@main struct HostProof {
 static func main() {
  _ = NSApplication.shared
  let host = InstrumentHost(output:URL(fileURLWithPath:CommandLine.arguments[1]))
  do {_ = try host.capture(notes:[48,60,72]);fatalError("Unloaded host accepted capture")}catch {print("PASS rejects unloaded host")}
  do {_ = try host.capture(notes:[49]);fatalError("Invalid note list accepted")}catch {print("PASS rejects unsupported note list")}
  var done = false,failed = false
  host.load {result in
   defer {done = true}
   do {
    print("Loaded \(try result.get())")
    let result = try host.capture(notes:[48,60,72])
    guard let takes = result["takes"] as? [[String:Any]],takes.count == 3 else {throw InstrumentHost.failure("Missing takes")}
    for (index,take) in takes.enumerated() {
     guard (take["rootNote"] as? Int) == [48,60,72][index],(take["frames"] as? Int) == 88200,let base64=take["wavBase64"] as? String,let data=Data(base64Encoded:base64),data.count>352800 else {throw InstrumentHost.failure("Invalid returned capture")}
    }
    print("PASS renders three real stereo notes directly, 88200 frames each")
    print(result["captureDirectory"]!)
   }catch {print("FAIL \(error)");failed = true}
  }
  let until=Date().addingTimeInterval(45)
  while !done && Date()<until {RunLoop.current.run(until:Date().addingTimeInterval(0.05))}
  if !done {print("FAIL timeout");failed=true}
  exit(failed ? 1:0)
 }
}
