import Foundation
import Network

// Static bundle assets only. USB is never exposed over HTTP.
final class LocalWebServer {
    static let port: UInt16 = 5220
    static let origin = "http://127.0.0.1:\(port)"
    private let root: URL
    private let queue = DispatchQueue(label: "studio.oppatchstudio.static-assets")
    private var listener: NWListener?
    private var connections: [ObjectIdentifier: NWConnection] = [:]
    init(root: URL) { self.root = root.resolvingSymlinksInPath().standardizedFileURL }
    func start(completion: @escaping (Error?) -> Void) throws {
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: Self.port)!)
        let listener = try NWListener(using: parameters)
        self.listener = listener
        var reported = false
        listener.stateUpdateHandler = { state in
            if !reported {
                switch state {
                case .ready: reported = true; DispatchQueue.main.async { completion(nil) }
                case .failed(let error): reported = true; DispatchQueue.main.async { completion(error) }
                default: break
                }
            }
        }
        listener.newConnectionHandler = { [weak self] connection in
            guard let self else { connection.cancel(); return }
            self.connections[ObjectIdentifier(connection)] = connection
            connection.stateUpdateHandler = { [weak self, weak connection] state in
                guard let connection else { return }
                switch state {
                case .cancelled, .failed: self?.connections.removeValue(forKey: ObjectIdentifier(connection))
                default: break
                }
            }
            connection.start(queue: self.queue)
            self.receive(connection, buffer: Data())
            self.queue.asyncAfter(deadline: .now() + 15) { [weak connection] in connection?.cancel() }
        }
        listener.start(queue: queue)
    }
    private func receive(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] content, _, complete, error in
            guard let self else { connection.cancel(); return }
            var request = buffer
            if let content { request.append(content) }
            guard request.count <= 16384 else { self.respond(connection, status: "431 Request Header Fields Too Large"); return }
            if request.range(of: Data("\r\n\r\n".utf8)) != nil { self.handle(connection, request: request) }
            else if complete || error != nil { connection.cancel() }
            else { self.receive(connection, buffer: request) }
        }
    }
    private func handle(_ connection: NWConnection, request: Data) {
        guard let text = String(data: request, encoding: .utf8), let first = text.components(separatedBy: "\r\n").first else {
            respond(connection, status: "400 Bad Request"); return
        }
        let pieces = first.split(separator: " ")
        guard pieces.count == 3, ["GET", "HEAD"].contains(pieces[0]),
              pieces[1].hasPrefix("/"), !pieces[1].hasPrefix("//"),
              let components = URLComponents(string: String(pieces[1])) else { respond(connection, status: "405 Method Not Allowed"); return }
        let path = components.path == "/" ? "/index.html" : components.path
        let file = root.appendingPathComponent(String(path.dropFirst())).resolvingSymlinksInPath().standardizedFileURL
        guard file.path.hasPrefix(root.path + "/"), let bytes = try? Data(contentsOf: file) else {
            respond(connection, status: "404 Not Found"); return
        }
        let types = ["html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8", "css": "text/css; charset=utf-8", "json": "application/json", "webmanifest": "application/manifest+json", "png": "image/png", "svg": "image/svg+xml", "ico": "image/x-icon", "woff2": "font/woff2", "ttf": "font/ttf", "wav": "audio/wav"]
        respond(connection, status: "200 OK", contentType: types[file.pathExtension] ?? "application/octet-stream", bytes: bytes, head: pieces[0] == "HEAD")
    }
    private func respond(_ connection: NWConnection, status: String, contentType: String = "text/plain", bytes: Data = Data(), head: Bool = false) {
        // Strict bundle-only scripts; retain blob audio, workers and file downloads used by the editor.
        let csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'none'"
        var response = Data("HTTP/1.1 \(status)\r\nContent-Type: \(contentType)\r\nContent-Length: \(bytes.count)\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nContent-Security-Policy: \(csp)\r\n\r\n".utf8)
        if !head { response.append(bytes) }
        connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
    }
}
