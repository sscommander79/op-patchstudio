#import "InstrumentEditor.h"
#import <AudioToolbox/AUCocoaUIView.h>
#import <objc/runtime.h>

NSView *OPCreateInstrumentEditor(AudioUnit unit, NSError **error) {
    NSCAssert([NSThread isMainThread], @"Audio Unit editors belong on the main thread");
    UInt32 size = 0;
    OSStatus status = AudioUnitGetPropertyInfo(unit, kAudioUnitProperty_CocoaUI, kAudioUnitScope_Global, 0, &size, NULL);
    NSView *view = nil;
    if (status == noErr && size >= sizeof(AudioUnitCocoaViewInfo) && size <= 65536) {
        AudioUnitCocoaViewInfo *info = calloc(1, size);
        if (info) {
            UInt32 actualSize = size;
            status = AudioUnitGetProperty(unit, kAudioUnitProperty_CocoaUI, kAudioUnitScope_Global, 0, info, &actualSize);
            if (status == noErr && actualSize >= sizeof(AudioUnitCocoaViewInfo) && actualSize <= size) {
                NSUInteger count = (actualSize - offsetof(AudioUnitCocoaViewInfo, mCocoaAUViewClass)) / sizeof(CFStringRef);
                NSBundle *bundle = info->mCocoaAUViewBundleLocation ? [NSBundle bundleWithURL:(__bridge NSURL *)info->mCocoaAUViewBundleLocation] : nil;
                if (bundle && (bundle.isLoaded || [bundle load])) {
                    for (NSUInteger i = 0; i < count && !view; i++) {
                        Class factoryClass = [bundle classNamed:(__bridge NSString *)info->mCocoaAUViewClass[i]];
                        if (![factoryClass conformsToProtocol:@protocol(AUCocoaUIBase)]) continue;
                        id<AUCocoaUIBase> factory = [[factoryClass alloc] init];
                        view = [factory uiViewForAudioUnit:unit withSize:NSMakeSize(900, 700)];
                        if (view) {
                            // Some AUv2 editors keep their factory as a delegate.
                            objc_setAssociatedObject(view, @selector(interfaceVersion), factory, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
                        }
                    }
                }
                if (info->mCocoaAUViewBundleLocation) CFRelease(info->mCocoaAUViewBundleLocation);
                for (NSUInteger i = 0; i < count; i++) if (info->mCocoaAUViewClass[i]) CFRelease(info->mCocoaAUViewClass[i]);
            }
            free(info);
        }
    }
    if (!view && error) *error = [NSError errorWithDomain:@"OPStudioInstrumentEditor" code:status userInfo:@{NSLocalizedDescriptionKey:@"This instrument does not provide a compatible editor in this preview."}];
    return view;
}
