import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var nodeProcess: Process?

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupMenu()
        startNodeServerIfNeeded()
        createWindow()
    }

    func setupMenu() {
        let mainMenu = NSMenu()
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        
        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu
        
        let appName = "Room-314"
        appMenu.addItem(withTitle: "About \(appName)", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Hide \(appName)", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h").keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit \(appName)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        
        // Edit Menu (Cut, Copy, Paste, Select All)
        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "Edit")
        editMenuItem.submenu = editMenu
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: Selector(("cut:")), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: Selector(("copy:")), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: Selector(("paste:")), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: Selector(("selectAll:")), keyEquivalent: "a")

        // View Menu (Reload, Fullscreen)
        let viewMenuItem = NSMenuItem()
        mainMenu.addItem(viewMenuItem)
        let viewMenu = NSMenu(title: "View")
        viewMenuItem.submenu = viewMenu
        let reloadItem = NSMenuItem(title: "Reload", action: #selector(reloadApp), keyEquivalent: "r")
        reloadItem.target = self
        viewMenu.addItem(reloadItem)
        viewMenu.addItem(withTitle: "Toggle Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f").keyEquivalentModifierMask = [.command, .control]

        NSApp.mainMenu = mainMenu
    }

    @objc func reloadApp() {
        if let url = URL(string: "http://127.0.0.1:3000") {
            webView.load(URLRequest(url: url))
        }
    }

    func startNodeServerIfNeeded() {
        // Check if server is already running
        let url = URL(string: "http://127.0.0.1:3000/api/health")!
        let semaphore = DispatchSemaphore(value: 0)
        var isRunning = false

        let task = URLSession.shared.dataTask(with: url) { _, response, _ in
            if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                isRunning = true
            }
            semaphore.signal()
        }
        task.resume()
        _ = semaphore.wait(timeout: .now() + 0.3)

        if isRunning {
            print("Room-314 server is already active.")
            return
        }

        // Locate app resources and node
        let bundle = Bundle.main
        let appDir = bundle.resourceURL?.appendingPathComponent("app")
        let serverDir = appDir?.appendingPathComponent("server")

        let dataDir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Room-314")
        try? FileManager.default.createDirectory(at: dataDir, withIntermediateDirectories: true)
        let uploadsDir = dataDir.appendingPathComponent("uploads")
        try? FileManager.default.createDirectory(at: uploadsDir, withIntermediateDirectories: true)

        let dbDest = dataDir.appendingPathComponent("room314.db")
        if !FileManager.default.fileExists(atPath: dbDest.path) {
            if let initialDb = appDir?.appendingPathComponent("database/room314.db"), FileManager.default.fileExists(atPath: initialDb.path) {
                try? FileManager.default.copyItem(at: initialDb, to: dbDest)
            }
        }

        // Find node executable
        var nodeBin = "/usr/local/bin/node"
        let possibleNodes = [
            "/opt/homebrew/bin/node",
            "/usr/local/bin/node",
            "/usr/bin/node"
        ]
        for p in possibleNodes {
            if FileManager.default.isExecutableFile(atPath: p) {
                nodeBin = p
                break
            }
        }

        if let serverPath = serverDir?.path, FileManager.default.isExecutableFile(atPath: nodeBin) {
            let proc = Process()
            proc.executableURL = URL(fileURLWithPath: nodeBin)
            proc.arguments = ["app.js"]
            proc.currentDirectoryURL = URL(fileURLWithPath: serverPath)

            var env = ProcessInfo.processInfo.environment
            env["PORT"] = "3000"
            env["NODE_ENV"] = "production"
            env["DB_PATH"] = dbDest.path
            env["UPLOAD_DIR"] = uploadsDir.path
            proc.environment = env

            let logFile = dataDir.appendingPathComponent("room314.log")
            if !FileManager.default.fileExists(atPath: logFile.path) {
                FileManager.default.createFile(atPath: logFile.path, contents: nil)
            }
            if let fileHandle = try? FileHandle(forWritingTo: logFile) {
                proc.standardOutput = fileHandle
                proc.standardError = fileHandle
            }

            try? proc.run()
            self.nodeProcess = proc
        }
    }

    func createWindow() {
        let rect = NSRect(x: 0, y: 0, width: 1320, height: 860)
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.center()
        window.title = "Room-314 POS"
        window.minSize = NSSize(width: 900, height: 600)
        window.setFrameAutosaveName("Room314MainWindow")

        let config = WKWebViewConfiguration()
        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self

        window.contentView?.addSubview(webView)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        pollAndLoad(attemptsLeft: 20)
    }

    func pollAndLoad(attemptsLeft: Int) {
        guard let url = URL(string: "http://127.0.0.1:3000") else { return }

        let healthUrl = URL(string: "http://127.0.0.1:3000/api/health")!
        let task = URLSession.shared.dataTask(with: healthUrl) { [weak self] _, response, _ in
            if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                DispatchQueue.main.async {
                    self?.webView.load(URLRequest(url: url))
                }
            } else if attemptsLeft > 0 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    self?.pollAndLoad(attemptsLeft: attemptsLeft - 1)
                }
            } else {
                DispatchQueue.main.async {
                    self?.webView.load(URLRequest(url: url))
                }
            }
        }
        task.resume()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func applicationWillTerminate(_ notification: Notification) {
        if let proc = nodeProcess, proc.isRunning {
            proc.terminate()
        }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
