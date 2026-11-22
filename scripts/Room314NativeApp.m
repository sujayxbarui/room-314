#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

@interface AppDelegate : NSObject <NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate>
@property (strong) NSWindow *window;
@property (strong) WKWebView *webView;
@property (strong) NSTask *serverTask;
@property (assign) NSInteger pollAttempts;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)aNotification {
    [self setupMenuBar];
    [self startBackendIfNeeded];
    [self setupWindow];
}

- (void)setupMenuBar {
    NSMenu *mainMenu = [[NSMenu alloc] init];

    // 1. Application Menu
    NSMenuItem *appMenuItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:appMenuItem];
    NSMenu *appMenu = [[NSMenu alloc] initWithTitle:@"Room-314"];
    [appMenuItem setSubmenu:appMenu];

    [appMenu addItemWithTitle:@"About Room-314" action:@selector(orderFrontStandardAboutPanel:) keyEquivalent:@""];
    [appMenu addItem:[NSMenuItem separatorItem]];
    [appMenu addItemWithTitle:@"Hide Room-314" action:@selector(hide:) keyEquivalent:@"h"];
    NSMenuItem *hideOthers = [appMenu addItemWithTitle:@"Hide Others" action:@selector(hideOtherApplications:) keyEquivalent:@"h"];
    [hideOthers setKeyEquivalentModifierMask:(NSEventModifierFlagCommand | NSEventModifierFlagOption)];
    [appMenu addItemWithTitle:@"Show All" action:@selector(unhideAllApplications:) keyEquivalent:@""];
    [appMenu addItem:[NSMenuItem separatorItem]];
    [appMenu addItemWithTitle:@"Quit Room-314" action:@selector(terminate:) keyEquivalent:@"q"];

    // 2. Edit Menu (Standard Mac keyboard shortcuts)
    NSMenuItem *editMenuItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:editMenuItem];
    NSMenu *editMenu = [[NSMenu alloc] initWithTitle:@"Edit"];
    [editMenuItem setSubmenu:editMenu];

    [editMenu addItemWithTitle:@"Undo" action:NSSelectorFromString(@"undo:") keyEquivalent:@"z"];
    NSMenuItem *redoItem = [editMenu addItemWithTitle:@"Redo" action:NSSelectorFromString(@"redo:") keyEquivalent:@"Z"];
    [redoItem setKeyEquivalentModifierMask:(NSEventModifierFlagCommand | NSEventModifierFlagShift)];
    [editMenu addItem:[NSMenuItem separatorItem]];
    [editMenu addItemWithTitle:@"Cut" action:NSSelectorFromString(@"cut:") keyEquivalent:@"x"];
    [editMenu addItemWithTitle:@"Copy" action:NSSelectorFromString(@"copy:") keyEquivalent:@"c"];
    [editMenu addItemWithTitle:@"Paste" action:NSSelectorFromString(@"paste:") keyEquivalent:@"v"];
    [editMenu addItemWithTitle:@"Select All" action:NSSelectorFromString(@"selectAll:") keyEquivalent:@"a"];

    // 3. View Menu
    NSMenuItem *viewMenuItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:viewMenuItem];
    NSMenu *viewMenu = [[NSMenu alloc] initWithTitle:@"View"];
    [viewMenuItem setSubmenu:viewMenu];

    NSMenuItem *reloadItem = [viewMenu addItemWithTitle:@"Reload" action:@selector(reloadPage:) keyEquivalent:@"r"];
    [reloadItem setTarget:self];
    NSMenuItem *fullScreenItem = [viewMenu addItemWithTitle:@"Toggle Full Screen" action:@selector(toggleFullScreen:) keyEquivalent:@"f"];
    [fullScreenItem setKeyEquivalentModifierMask:(NSEventModifierFlagCommand | NSEventModifierFlagControl)];

    // 4. Window Menu
    NSMenuItem *windowMenuItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:windowMenuItem];
    NSMenu *windowMenu = [[NSMenu alloc] initWithTitle:@"Window"];
    [windowMenuItem setSubmenu:windowMenu];
    [windowMenu addItemWithTitle:@"Minimize" action:@selector(performMiniaturize:) keyEquivalent:@"m"];
    [windowMenu addItemWithTitle:@"Zoom" action:@selector(performZoom:) keyEquivalent:@""];

    [NSApp setMainMenu:mainMenu];
}

- (void)reloadPage:(id)sender {
    NSURL *url = [NSURL URLWithString:@"http://127.0.0.1:3000"];
    [self.webView loadRequest:[NSURLRequest requestWithURL:url]];
}

- (void)setupWindow {
    NSRect screenRect = [[NSScreen mainScreen] visibleFrame];
    CGFloat width = MIN(1320, screenRect.size.width - 60);
    CGFloat height = MIN(860, screenRect.size.height - 60);
    NSRect windowRect = NSMakeRect((screenRect.size.width - width) / 2, (screenRect.size.height - height) / 2, width, height);

    self.window = [[NSWindow alloc] initWithContentRect:windowRect
                                             styleMask:(NSWindowStyleMaskTitled |
                                                        NSWindowStyleMaskClosable |
                                                        NSWindowStyleMaskMiniaturizable |
                                                        NSWindowStyleMaskResizable)
                                               backing:NSBackingStoreBuffered
                                                 defer:NO];

    [self.window setTitle:@"Room-314 POS"];
    [self.window setMinSize:NSSizeFromCGSize(CGSizeMake(900, 600))];
    [self.window setFrameAutosaveName:@"Room314MainWindow"];

    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    // Allow local file uploads and cookies
    [config.preferences setValue:@YES forKey:@"allowFileAccessFromFileURLs"];

    self.webView = [[WKWebView alloc] initWithFrame:[[self.window contentView] bounds] configuration:config];
    [self.webView setAutoresizingMask:(NSViewWidthSizable | NSViewHeightSizable)];
    [self.webView setNavigationDelegate:self];
    [self.webView setUIDelegate:self]; // Critical: enables file upload dialogs & JS alerts/confirms

    [[self.window contentView] addSubview:self.webView];
    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];

    self.pollAttempts = 25;
    [self pollServerAndLoad];
}

#pragma mark - WKUIDelegate (Enables <input type="file"> open panel, alert, and confirm)

- (void)webView:(WKWebView *)webView
runOpenPanelWithParameters:(WKOpenPanelParameters *)parameters
initiatedByFrame:(WKFrameInfo *)frame
completionHandler:(void (^)(NSArray<NSURL *> * _Nullable URLs))completionHandler {
    NSOpenPanel *openPanel = [NSOpenPanel openPanel];
    [openPanel setCanChooseFiles:YES];
    [openPanel setCanChooseDirectories:NO];
    [openPanel setAllowsMultipleSelection:parameters.allowsMultipleSelection];
    [openPanel setAllowedFileTypes:@[@"png", @"jpg", @"jpeg", @"webp", @"gif", @"heic", @"pdf", @"db"]];
    [openPanel setPrompt:@"Select"];
    [openPanel setMessage:@"Choose screenshot or file to upload"];

    [openPanel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse result) {
        if (result == NSModalResponseOK) {
            completionHandler(openPanel.URLs);
        } else {
            completionHandler(nil);
        }
    }];
}

- (void)webView:(WKWebView *)webView
runJavaScriptAlertPanelWithMessage:(NSString *)message
initiatedByFrame:(WKFrameInfo *)frame
completionHandler:(void (^)(void))completionHandler {
    NSAlert *alert = [[NSAlert alloc] init];
    [alert setMessageText:@"Room-314"];
    [alert setInformativeText:message];
    [alert addButtonWithTitle:@"OK"];
    [alert beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse returnCode) {
        completionHandler();
    }];
}

- (void)webView:(WKWebView *)webView
runJavaScriptConfirmPanelWithMessage:(NSString *)message
initiatedByFrame:(WKFrameInfo *)frame
completionHandler:(void (^)(BOOL result))completionHandler {
    NSAlert *alert = [[NSAlert alloc] init];
    [alert setMessageText:@"Room-314 Confirmation"];
    [alert setInformativeText:message];
    [alert addButtonWithTitle:@"OK"];
    [alert addButtonWithTitle:@"Cancel"];
    [alert beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse returnCode) {
        completionHandler(returnCode == NSAlertFirstButtonReturn);
    }];
}

- (void)startBackendIfNeeded {
    if ([self isServerRunning]) {
        NSLog(@"Room-314 backend server is already running.");
        return;
    }

    // Free port 3000 from any dead or zombie processes before starting
    [self runShellCommand:@"lsof -t -i :3000 | xargs kill -9 2>/dev/null || true"];

    NSString *bundlePath = [[NSBundle mainBundle] bundlePath];
    NSString *appDir = [bundlePath stringByAppendingPathComponent:@"Contents/Resources/app"];
    NSString *serverDir = [appDir stringByAppendingPathComponent:@"server"];

    NSString *appSupport = [NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, YES) firstObject];
    NSString *dataDir = [appSupport stringByAppendingPathComponent:@"Room-314"];
    NSString *uploadsDir = [dataDir stringByAppendingPathComponent:@"uploads"];
    NSString *dbDest = [dataDir stringByAppendingPathComponent:@"room314.db"];

    NSFileManager *fm = [NSFileManager defaultManager];
    [fm createDirectoryAtPath:dataDir withIntermediateDirectories:YES attributes:nil error:nil];
    [fm createDirectoryAtPath:uploadsDir withIntermediateDirectories:YES attributes:nil error:nil];

    if (![fm fileExistsAtPath:dbDest]) {
        NSString *initialDb = [appDir stringByAppendingPathComponent:@"database/room314.db"];
        if ([fm fileExistsAtPath:initialDb]) {
            [fm copyItemAtPath:initialDb toPath:dbDest error:nil];
        }
    }

    NSArray *nodePaths = @[
        @"/opt/homebrew/bin/node",
        @"/usr/local/bin/node",
        @"/usr/bin/node",
        @"/opt/homebrew/opt/node/bin/node"
    ];
    NSString *nodeBin = nil;
    for (NSString *p in nodePaths) {
        if ([fm isExecutableFileAtPath:p]) {
            nodeBin = p;
            break;
        }
    }

    if (!nodeBin) {
        NSString *whichNode = [self runShellCommand:@"source ~/.zshrc 2>/dev/null; which node"];
        if (whichNode.length > 0 && [fm isExecutableFileAtPath:whichNode]) {
            nodeBin = whichNode;
        }
    }

    if (!nodeBin) {
        NSAlert *alert = [[NSAlert alloc] init];
        [alert setMessageText:@"Node.js Required"];
        [alert setInformativeText:@"Room-314 requires Node.js. Please install Node.js from https://nodejs.org and relaunch the app."];
        [alert runModal];
        [NSApp terminate:nil];
        return;
    }

    NSTask *task = [[NSTask alloc] init];
    [task setLaunchPath:nodeBin];
    [task setArguments:@[@"app.js"]];
    [task setCurrentDirectoryPath:serverDir];

    NSMutableDictionary *env = [[[NSProcessInfo processInfo] environment] mutableCopy];
    env[@"PORT"] = @"3000";
    env[@"NODE_ENV"] = @"production";
    env[@"DB_PATH"] = dbDest;
    env[@"UPLOAD_DIR"] = uploadsDir;
    [task setEnvironment:env];

    NSString *logPath = [dataDir stringByAppendingPathComponent:@"room314.log"];
    if (![fm fileExistsAtPath:logPath]) {
        [fm createFileAtPath:logPath contents:nil attributes:nil];
    }
    NSFileHandle *logHandle = [NSFileHandle fileHandleForWritingAtPath:logPath];
    [task setStandardOutput:logHandle];
    [task setStandardError:logHandle];

    __weak typeof(self) weakSelf = self;
    task.terminationHandler = ^(NSTask *t) {
        NSLog(@"Room-314 server task exited with status %d", [t terminationStatus]);
        // Auto-restart watchdog if app is still running
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            [weakSelf startBackendIfNeeded];
        });
    };

    @try {
        [task launch];
        self.serverTask = task;
        NSLog(@"Launched Room-314 background server (PID: %d)", [task processIdentifier]);
    } @catch (NSException *exception) {
        NSLog(@"Failed to launch server task: %@", exception.reason);
    }
}

- (BOOL)isServerRunning {
    NSURL *url = [NSURL URLWithString:@"http://127.0.0.1:3000/api/health"];
    NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:url];
    [req setTimeoutInterval:0.4];

    dispatch_semaphore_t sem = dispatch_semaphore_create(0);
    __block BOOL running = NO;

    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:req completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
        if (!error && [(NSHTTPURLResponse *)response statusCode] == 200) {
            running = YES;
        }
        dispatch_semaphore_signal(sem);
    }];
    [task resume];
    dispatch_semaphore_wait(sem, dispatch_time(DISPATCH_TIME_NOW, (int64_t)(400 * NSEC_PER_MSEC)));
    return running;
}

- (void)pollServerAndLoad {
    NSURL *url = [NSURL URLWithString:@"http://127.0.0.1:3000"];
    NSURL *healthUrl = [NSURL URLWithString:@"http://127.0.0.1:3000/api/health"];
    NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:healthUrl];
    [req setTimeoutInterval:0.5];

    __weak typeof(self) weakSelf = self;
    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:req completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (!error && [(NSHTTPURLResponse *)response statusCode] == 200) {
                [weakSelf.webView loadRequest:[NSURLRequest requestWithURL:url]];
            } else if (weakSelf.pollAttempts > 0) {
                weakSelf.pollAttempts--;
                dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(250 * NSEC_PER_MSEC)), dispatch_get_main_queue(), ^{
                    [weakSelf pollServerAndLoad];
                });
            } else {
                [weakSelf.webView loadRequest:[NSURLRequest requestWithURL:url]];
            }
        });
    }];
    [task resume];
}

- (NSString *)runShellCommand:(NSString *)cmd {
    NSTask *task = [[NSTask alloc] init];
    [task setLaunchPath:@"/bin/bash"];
    [task setArguments:@[@"-c", cmd]];

    NSPipe *pipe = [NSPipe pipe];
    [task setStandardOutput:pipe];
    [task launch];

    NSData *data = [[pipe fileHandleForReading] readDataToEndOfFile];
    NSString *output = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    return [output stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
    return YES;
}

- (void)applicationWillTerminate:(NSNotification *)aNotification {
    if (self.serverTask && [self.serverTask isRunning]) {
        [self.serverTask terminate];
        NSLog(@"Terminated Room-314 server task.");
    }
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        AppDelegate *delegate = [[AppDelegate alloc] init];
        [app setDelegate:delegate];
        [app run];
    }
    return 0;
}
