import AppKit
import AVFoundation
@main struct JourneyTests {
 static func main() {
  _ = NSApplication.shared
  let host = InstrumentHost(output:URL(fileURLWithPath:CommandLine.arguments[1]))
  let catalog = host.catalog()
  print("Installed instrument count: \(catalog.count)")
  do {let bytes=try JSONSerialization.data(withJSONObject:catalog,options:[.prettyPrinted,.sortedKeys]);try bytes.write(to:URL(fileURLWithPath:CommandLine.arguments[1]).appendingPathComponent("instrument-catalog.json"))}catch{print(error);exit(1)}
  for notes:[UInt8] in [[],[60,60],Array(0...24)] {
   do {_ = try host.capture(notes:notes);print("FAIL accepted invalid plan");exit(1)}catch{print("PASS rejects invalid plan \(notes.count)")}
  }
  let wanted = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "Serum"
  guard let item=catalog.first(where:{($0["name"] as? String) == wanted}),let id=item["id"] as? String else {print("FAIL requested instrument not installed");exit(1)}
  var done=false,failed=false
  host.load(id:id) {result in
   defer {done=true}
   do {
    print("Loaded \(try result.get())")
    let notes:[UInt8]=[48,51,54,57,60,63,66,69,72]
    let result=try host.capture(notes:notes,hold:0.5,release:0.75,velocity:90)
    guard let takes=result["takes"] as? [[String:Any]],takes.count==9 else {throw InstrumentHost.failure("Expected nine notes")}
    for (i,take) in takes.enumerated(){guard take["rootNote"] as? Int == Int(notes[i]),take["frames"] as? Int == 55125 else {throw InstrumentHost.failure("Wrong mapping or frames")}}
    print("PASS nine real notes C2–C4 every 3 semitones, 55125 frames each")
    print(result["captureDirectory"]!)
   }catch{print("FAIL \(error)");failed=true}
  }
  let deadline=Date().addingTimeInterval(90)
  while !done && Date()<deadline {RunLoop.current.run(until:Date().addingTimeInterval(0.05))}
  if !done {print("FAIL timeout");failed=true}
  exit(failed ? 1:0)
 }
}
