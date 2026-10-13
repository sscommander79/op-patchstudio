import AppKit
import WebKit

@main struct Main {
    static func main() {let app = NSApplication.shared;let delegate = ProofApp();app.delegate = delegate;app.setActivationPolicy(.regular);app.run()}
}
final class ProofApp: NSObject, NSApplicationDelegate, WKScriptMessageHandlerWithReply, WKNavigationDelegate, WKDownloadDelegate {
    private var window:NSWindow!
    private var web:WKWebView!
    private var server:LocalWebServer?
    private let output = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/OP-PatchStudio Serum Integration/Captures")
    private lazy var host = InstrumentHost(output:output)
    private var busy = false
    private var editorWindow:NSWindow?
    private var editorReply:((Any?,String?)->Void)?
    private var editorStatus:NSTextField?
    private var previewSound:NSSound?
    private func openEditor(reply:@escaping(Any?,String?)->Void) {
        do {
            let view = try host.editorView()
            let size = view.frame.size
            guard size.width > 0,size.height > 0 else {throw InstrumentHost.failure("The instrument editor has no visible size.")}
            let available = window.screen?.visibleFrame.size ?? NSSize(width:1200,height:900)
            let width = min(max(size.width,650),available.width-80)
            let height = min(size.height+60,available.height-120)
            let sheet = NSWindow(contentRect:NSRect(x:0,y:0,width:width,height:height),styleMask:[.titled,.resizable],backing:.buffered,defer:false)
            sheet.title = "\(host.soundInfo()["name"] as? String ?? "Instrument") · choose your sound"
            sheet.isReleasedWhenClosed = false
            let container = NSView(frame:NSRect(x:0,y:0,width:width,height:height))
            let scroll = NSScrollView(frame:NSRect(x:0,y:60,width:width,height:height-60))
            scroll.autoresizingMask = [.width,.height];scroll.hasVerticalScroller = true;scroll.hasHorizontalScroller = true;scroll.documentView = view
            container.addSubview(scroll)
            let preview = NSButton(title:"Preview note",target:self,action:#selector(previewEditorNote))
            preview.frame = NSRect(x:16,y:16,width:120,height:30);preview.bezelStyle = .rounded;container.addSubview(preview)
            let status = NSTextField(labelWithString:"Choose a preset in the instrument, then Done.")
            status.frame = NSRect(x:150,y:20,width:width-270,height:22);status.autoresizingMask = [.width];container.addSubview(status);editorStatus = status
            let done = NSButton(title:"Done",target:self,action:#selector(finishEditor))
            done.frame = NSRect(x:width-96,y:16,width:80,height:30);done.autoresizingMask = [.minXMargin];done.bezelStyle = .rounded;container.addSubview(done)
            sheet.contentView = container
            busy = true;editorWindow = sheet;editorReply = reply
            window.beginSheet(sheet)
        }catch {reply(nil,error.localizedDescription)}
    }
    @objc private func previewEditorNote() {
        // On the main thread so the editor cannot change AU state during this short render.
        previewSound?.stop()
        do {
            let result = try host.capture(notes:[60],hold:0.5,release:1)
            guard let directory = result["captureDirectory"] as? String,let takes = result["takes"] as? [[String:Any]],let name = takes.first?["name"] as? String else {throw InstrumentHost.failure("Could not preview this sound.")}
            previewSound = NSSound(contentsOf:URL(fileURLWithPath:directory).appendingPathComponent(name),byReference:false)
            guard previewSound?.play() == true else {throw InstrumentHost.failure("Could not play the preview.")}
            editorStatus?.stringValue = "Playing C3"
        }catch {editorStatus?.stringValue = error.localizedDescription}
    }
    @objc private func finishEditor() {
        guard let sheet = editorWindow else {return}
        previewSound?.stop();previewSound = nil
        window.endSheet(sheet);sheet.orderOut(nil);sheet.contentView = nil;editorWindow = nil;editorStatus = nil
        busy = false
        let reply = editorReply;editorReply = nil;reply?(host.soundInfo(),nil)
        window.makeKeyAndOrderFront(nil)
    }
    func applicationDidFinishLaunching(_ notification:Notification) {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.addScriptMessageHandler(self,contentWorld:.page,name:"instrumentStudio")
        web = WKWebView(frame:.zero,configuration:config);web.navigationDelegate = self
        window = NSWindow(contentRect:NSRect(x:0,y:0,width:1320,height:940),styleMask:[.titled,.closable,.miniaturizable,.resizable],backing:.buffered,defer:false)
        window.title = "OP-PatchStudio · Serum Integration";window.contentView = web;window.center();window.makeKeyAndOrderFront(nil)
        let menu = NSMenu();let item = NSMenuItem();menu.addItem(item);let appMenu = NSMenu();item.submenu = appMenu
        appMenu.addItem(withTitle:"Quit OP-PatchStudio",action:#selector(NSApplication.terminate(_:)),keyEquivalent:"q");NSApp.mainMenu = menu
        do {let server = LocalWebServer(root:Bundle.main.resourceURL!.appendingPathComponent("web"));self.server = server
            try server.start {error in if let error {self.show(error.localizedDescription)} else {// Load the installed bundle, never an older browser service-worker copy.
                // IndexedDB and local storage containing projects and preferences stay intact.
                config.websiteDataStore.removeData(ofTypes:[WKWebsiteDataTypeServiceWorkerRegistrations,WKWebsiteDataTypeFetchCache,WKWebsiteDataTypeDiskCache],modifiedSince:.distantPast) {
                    self.web.load(URLRequest(url:URL(string:LocalWebServer.origin + "/index.html#/studio/multisample/instrument")!))
                }}}
        } catch {show(error.localizedDescription)}
        NSApp.activate(ignoringOtherApps:true)
    }
    private func trusted(_ url:URL?) -> Bool {url?.scheme == "http" && url?.host == "127.0.0.1" && url?.port == Int(LocalWebServer.port)}
    func userContentController(_ c:WKUserContentController,didReceive message:WKScriptMessage,replyHandler:@escaping(Any?,String?)->Void) {
        guard message.frameInfo.isMainFrame,trusted(message.frameInfo.request.url),let body = message.body as? [String:Any],let op = body["operation"] as? String else {replyHandler(nil,"Untrusted request");return}
        guard !busy else {replyHandler(nil,"Instrument is busy");return}
        if op == "list" {replyHandler(["instruments":host.catalog()],nil);return}
        if op == "load" {
            guard let id = body["id"] as? String else {replyHandler(nil,"Choose an instrument");return}
            busy = true;host.load(id:id) {result in self.busy = false;switch result {case .success(let info):replyHandler(info,nil);case .failure(let error):replyHandler(nil,error.localizedDescription)}};return
        }
        if op == "editor" {openEditor(reply:replyHandler);return}
        if op == "preset" {
            do {guard let number = body["number"] as? Int else {throw InstrumentHost.failure("Choose a sound")};replyHandler(try host.selectPreset(number),nil)}catch {replyHandler(nil,error.localizedDescription)};return
        }
        guard op == "record" || op == "check",let rawNotes = body["notes"] as? [Int],rawNotes.allSatisfy({$0 >= 0 && $0 <= 127}),let hold = body["hold"] as? Double,let release = body["release"] as? Double,let velocity = body["velocity"] as? Int,velocity >= 1,velocity <= 127 else {replyHandler(nil,"Invalid recording request");return}
        busy = true
        DispatchQueue.global(qos:.userInitiated).async {
            do {
                let result = try self.host.capture(notes:rawNotes.map(UInt8.init),hold:hold,release:release,velocity:UInt8(velocity)) {done,total in
                    DispatchQueue.main.async {self.web.callAsyncJavaScript("window.dispatchEvent(new CustomEvent('instrument-studio-progress',{detail:{done,total}}));",arguments:["done":done,"total":total],in:nil,in:.page) {_ in}}
                }
                DispatchQueue.main.async {self.busy = false;replyHandler(result,nil)}
            }catch {DispatchQueue.main.async {self.busy = false;replyHandler(nil,error.localizedDescription)}}
        }
    }
    func webView(_ webView:WKWebView,decidePolicyFor navigationAction:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void) {
        if navigationAction.shouldPerformDownload,navigationAction.request.url?.scheme == "blob",trusted(webView.url) {decisionHandler(.download);return}
        decisionHandler(trusted(navigationAction.request.url) ? .allow : .cancel)
    }
    func webView(_ webView:WKWebView,decidePolicyFor navigationResponse:WKNavigationResponse,decisionHandler:@escaping(WKNavigationResponsePolicy)->Void) {decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)}
    func webView(_ webView:WKWebView,navigationAction:WKNavigationAction,didBecome download:WKDownload) {download.delegate = self}
    func webView(_ webView:WKWebView,navigationResponse:WKNavigationResponse,didBecome download:WKDownload) {download.delegate = self}
    func download(_ download:WKDownload,decideDestinationUsing response:URLResponse,suggestedFilename:String,completionHandler:@escaping(URL?)->Void) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = URL(fileURLWithPath:suggestedFilename).lastPathComponent
        panel.canCreateDirectories = true
        panel.beginSheetModal(for:window) { response in
            guard response == .OK, let url = panel.url else {
                self.exportStatus("Export cancelled. Your recordings are still here.")
                completionHandler(nil)
                return
            }
            completionHandler(url)
        }
    }
    private func exportStatus(_ text:String) {
        web.callAsyncJavaScript("window.dispatchEvent(new CustomEvent('instrument-studio-export-status',{detail:{message}}));",arguments:["message":text],in:nil,in:.page) {_ in}
    }
    func downloadDidFinish(_ download:WKDownload) {exportStatus("Preset exported. Your recordings are ready to keep.")}
    func download(_ download:WKDownload,didFailWithError error:Error,resumeData:Data?) {
        if (error as NSError).code != NSURLErrorCancelled {exportStatus("Could not export: " + error.localizedDescription)}
    }
    private func show(_ text:String) {let alert = NSAlert();alert.messageText = "OP-PatchStudio";alert.informativeText = text;alert.runModal()}
    func applicationShouldTerminateAfterLastWindowClosed(_ sender:NSApplication)->Bool {true}
}
