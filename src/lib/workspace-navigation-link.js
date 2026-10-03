export function shouldInterceptWorkspaceLink(event) {
  return Boolean(event)
    && !event.defaultPrevented
    && event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
    && (!event.currentTarget?.target || event.currentTarget.target === '_self');
}
