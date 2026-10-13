import Foundation
import AVFoundation
import AudioToolbox
import AppKit
import CryptoKit

// Isolated feasibility code: one installed AUv2 instrument, no device capture APIs.
final class InstrumentHost {
    private var instrument: AVAudioUnitMIDIInstrument?
    private var engine: AVAudioEngine?
    private let format = AVAudioFormat(standardFormatWithSampleRate:44100, channels:2)!
    let output: URL
    init(output: URL) { self.output = output }
    static func code(_ s: String) -> OSType { s.utf8.reduce(0) { ($0 << 8) | UInt32($1) } }
    static func failure(_ message: String) -> Error { NSError(domain:"OPStudioInstrumentProof",code:1,userInfo:[NSLocalizedDescriptionKey:message]) }
    private var loadedName = "Instrument"
    private var loadedID = ""
    private var initialSound: [String:Any]?
    private func components() -> [AVAudioUnitComponent] {
        let description = AudioComponentDescription(componentType:kAudioUnitType_MusicDevice,componentSubType:0,componentManufacturer:0,componentFlags:0,componentFlagsMask:0)
        return AVAudioUnitComponentManager.shared().components(matching:description).sorted {$0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending}
    }
    private func identifier(_ d:AudioComponentDescription) -> String {"\(d.componentType):\(d.componentSubType):\(d.componentManufacturer)"}
    func catalog() -> [[String:Any]] {components().map { ["id":identifier($0.audioComponentDescription),"name":$0.name] }}
    func editorView() throws -> NSView {
        guard let instrument else {throw Self.failure("Choose an instrument first.")}
        var error:NSError?
        guard let view = OPCreateInstrumentEditor(instrument.audioUnit,&error) else {throw error ?? Self.failure("This instrument editor is unavailable.")}
        return view
    }
    private func stateEvidence() throws -> (Data,String) {
        guard let state = instrument?.auAudioUnit.fullState else {throw Self.failure("Cannot read this instrument's sound state.")}
        let bytes = try PropertyListSerialization.data(fromPropertyList:state,format:.binary,options:0)
        return (bytes,SHA256.hash(data:bytes).map {String(format:"%02x",$0)}.joined())
    }
    func soundInfo() -> [String:Any] {
        ["name":loadedName,"id":loadedID,"sound":instrument?.auAudioUnit.currentPreset?.name ?? "Initial sound","presets":(instrument?.auAudioUnit.factoryPresets ?? []).map {["number":$0.number,"name":$0.name]}]
    }
    func selectPreset(_ number:Int) throws -> [String:Any] {
        guard let instrument else {throw Self.failure("Choose an instrument first.")}
        if number == -999 {instrument.auAudioUnit.fullState = initialSound;return soundInfo()}
        guard let preset = instrument.auAudioUnit.factoryPresets?.first(where:{$0.number == number}) else {throw Self.failure("This sound is unavailable.")}
        instrument.auAudioUnit.currentPreset = preset
        return soundInfo()
    }
    func load(id:String, _ completion: @escaping (Result<[String:Any], Error>) -> Void) {
        guard let component = components().first(where:{identifier($0.audioComponentDescription) == id}) else {completion(.failure(Self.failure("That installed instrument is unavailable.")));return}
        let d = component.audioComponentDescription
        AVAudioUnit.instantiate(with:d,options:[.loadInProcess]) { unit,error in
            DispatchQueue.main.async {
                do {
                    guard let unit = unit as? AVAudioUnitMIDIInstrument else {throw error ?? Self.failure("The selected Audio Unit could not load.")}
                    let engine = AVAudioEngine()
                    // Enable manual mode BEFORE accessing mixer/output nodes: no hardware route.
                    try engine.enableManualRenderingMode(.offline,format:self.format,maximumFrameCount:1024)
                    engine.attach(unit);engine.connect(unit,to:engine.mainMixerNode,format:self.format)
                    self.engine?.stop();self.engine = engine;self.instrument = unit;self.loadedName = component.name;self.loadedID = id;self.initialSound = unit.auAudioUnit.fullState
                    completion(.success(self.soundInfo()))
                } catch {completion(.failure(error))}
            }
        }
    }
    func capture(notes:[UInt8], hold:Double = 1, release:Double = 1, velocity:UInt8 = 100, progress:((Int,Int)->Void)? = nil) throws -> [String:Any] {
        guard !notes.isEmpty,notes.count <= 24,Set(notes).count == notes.count,notes.allSatisfy({$0 <= 127}),hold.isFinite,release.isFinite,hold >= 0.25,hold <= 5,release >= 0.25,release <= 8,Double(notes.count)*(hold+release) <= 180,velocity >= 1,velocity <= 127 else {throw Self.failure("Choose up to 24 unique MIDI notes and at most 180 seconds of audio.")}
        let heldFrames = Int((hold*44100).rounded()),releaseFrames = Int((release*44100).rounded())
        guard let instrument,let engine else {throw Self.failure("Load the instrument first.")}
        let folder = output.appendingPathComponent("capture-" + UUID().uuidString)
        try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
        // Preserve evidence of the exact edited instance before any render/reset.
        let (soundState,soundHash) = try stateEvidence()
        let soundName = soundInfo()["sound"] as? String ?? "Custom sound"
        try soundState.write(to:folder.appendingPathComponent("instrument-state.plist"))
        engine.prepare();try engine.start()
        defer {for note in notes {instrument.stopNote(note,onChannel:0)};engine.stop()}
        guard let buffer = AVAudioPCMBuffer(pcmFormat:engine.manualRenderingFormat,frameCapacity:1024) else {throw Self.failure("Cannot allocate render buffer.")}
        func render(frames:Int, consume:(AVAudioPCMBuffer)throws->Void) throws {
            var remaining = frames, stalls = 0
            let deadline = Date().addingTimeInterval(10)
            while remaining > 0 {
                if Date() > deadline {throw Self.failure("Instrument rendering timed out.")}
                let count = min(remaining,1024)
                let status = try engine.renderOffline(AVAudioFrameCount(count),to:buffer)
                switch status {
                case .success:
                    guard buffer.frameLength == count else {throw Self.failure("Incomplete audio block.")}
                    try consume(buffer);remaining -= count;stalls = 0
                case .cannotDoInCurrentContext: stalls += 1;if stalls > 100 {throw Self.failure("Instrument rendering stalled.")}
                case .insufficientDataFromInputNode: throw Self.failure("Unexpected input dependency in internal recording.")
                case .error: throw Self.failure("Instrument rendering failed.")
                @unknown default: throw Self.failure("Unknown render result.")
                }
            }
        }
        var takes = [[String:Any]]()
        for (index,note) in notes.enumerated() {
            instrument.sendController(123,withValue:0,onChannel:0)
            instrument.sendController(120,withValue:0,onChannel:0)
            instrument.auAudioUnit.reset()
            try render(frames:44100) {_ in}
            let names = ["C","Cs","D","Ds","E","F","Fs","G","Gs","A","As","B"]
            let label = "\(names[Int(note)%12])\(Int(note)/12-2)"
            let base = loadedName.components(separatedBy:CharacterSet.alphanumerics.inverted).joined().prefix(48)
            let name = "\(base)_\(label).wav", url = folder.appendingPathComponent(name)
            var peak:Float = 0, squares:Double = 0, count = 0
            do {
                let file = try AVAudioFile(forWriting:url,settings:[AVFormatIDKey:kAudioFormatLinearPCM,AVSampleRateKey:44100,AVNumberOfChannelsKey:2,AVLinearPCMBitDepthKey:16,AVLinearPCMIsFloatKey:false,AVLinearPCMIsBigEndianKey:false],commonFormat:.pcmFormatFloat32,interleaved:false)
                func write(_ b:AVAudioPCMBuffer) throws {
                    guard let pcm = b.floatChannelData else {throw Self.failure("Missing PCM.")}
                    for c in 0..<2 {for f in 0..<Int(b.frameLength) {let x = pcm[c][f];guard x.isFinite else {throw Self.failure("Invalid audio sample.")};peak = max(peak,abs(x));squares += Double(x)*Double(x);count += 1}}
                    try file.write(from:b)
                }
                instrument.startNote(note,withVelocity:velocity,onChannel:0)
                try render(frames:heldFrames,consume:write)
                instrument.stopNote(note,onChannel:0)
                try render(frames:releaseFrames,consume:write)
            }
            guard peak > 0.0001, peak < 0.999 else {throw Self.failure("Recording is silent or clipped; nothing was added.")}
            takes.append(["name":name,"rootNote":Int(note),"wavBase64":try Data(contentsOf:url).base64EncodedString(),"frames":heldFrames+releaseFrames,"sampleRate":44100,"channels":2,"peak":peak,"rms":sqrt(squares/Double(count))])
            progress?(index+1,notes.count)
        }
        let result:[String:Any] = ["instrument":loadedName,"sound":soundName,"soundStateSHA256":soundHash,"hold":hold,"release":release,"velocity":Int(velocity),"format":"AUv2","route":"in-process instrument → offline engine → stereo PCM","audioInputUsed":false,"notes":notes.map(Int.init),"takes":takes,"captureDirectory":folder.path]
        let summary = result.merging(["takes":takes.map { $0.filter { $0.key != "wavBase64" } }]) {_,new in new}
        try JSONSerialization.data(withJSONObject:summary,options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("capture-evidence.json"))
        return result
    }
}
