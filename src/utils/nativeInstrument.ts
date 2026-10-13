/** The native bridge is available only inside the desktop instrument host. */
export function hasNativeInstrumentHost(): boolean {
 return Boolean((window as unknown as {webkit?:{messageHandlers?:{instrumentStudio?:unknown}}}).webkit?.messageHandlers?.instrumentStudio);
}
