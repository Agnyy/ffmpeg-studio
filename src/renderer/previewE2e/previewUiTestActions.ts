import { DEFAULT_TIMELINE_ZOOM } from "../utils/timelineZoom";

function pointerInit(clientX: number, clientY: number, buttons = 1): PointerEventInit {
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX,
    clientY,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    buttons,
  };
}

export function queryTimelineRuler(): HTMLElement | null {
  return document.querySelector('[data-testid="timeline-ruler"]');
}

export function queryTimelineScroll(): HTMLElement | null {
  return document.querySelector('[data-testid="timeline-scroll-area"]');
}

export function getTimelineZoom(): number {
  const ruler = queryTimelineRuler();
  const raw = ruler?.getAttribute("data-timeline-zoom");
  if (!raw) {
    return DEFAULT_TIMELINE_ZOOM;
  }
  const zoom = Number.parseFloat(raw);
  return Number.isFinite(zoom) ? zoom : DEFAULT_TIMELINE_ZOOM;
}

export function clientPointForTimelineTime(
  timeSec: number
): { clientX: number; clientY: number; target: HTMLElement } | null {
  const ruler = queryTimelineRuler();
  const scroll = queryTimelineScroll();
  if (!ruler || !scroll) {
    return null;
  }

  const zoom = getTimelineZoom();
  const contentX = timeSec * zoom;
  const scrollRect = scroll.getBoundingClientRect();
  scroll.scrollLeft = Math.max(0, contentX - scrollRect.width * 0.35);

  const clientX = scrollRect.left + contentX - scroll.scrollLeft;
  const rulerRect = ruler.getBoundingClientRect();
  const clientY = rulerRect.top + rulerRect.height / 2;
  return { clientX, clientY, target: ruler };
}

export function dispatchPointerTap(target: Element, clientX: number, clientY: number): void {
  target.dispatchEvent(new PointerEvent("pointerdown", pointerInit(clientX, clientY, 1)));
  target.dispatchEvent(new PointerEvent("pointerup", pointerInit(clientX, clientY, 0)));
}

export function clickTimelineAtTime(timeSec: number): boolean {
  const point = clientPointForTimelineTime(timeSec);
  if (!point) {
    return false;
  }
  dispatchPointerTap(point.target, point.clientX, point.clientY);
  return true;
}

export function clickTimelineTrackAtTime(timeSec: number): boolean {
  const point = clientPointForTimelineTime(timeSec);
  const track = document.querySelector('[data-testid="timeline-track-area"]');
  if (!point || !track) {
    return false;
  }
  dispatchPointerTap(track, point.clientX, point.clientY + 24);
  return true;
}

export function clickPreviewPlayButton(): boolean {
  const button = document.querySelector(
    '[data-testid="preview-play-button"]'
  ) as HTMLButtonElement | null;
  if (!button || button.disabled) {
    return false;
  }
  button.click();
  return true;
}

export function dragPlayheadToTime(targetTimeSec: number): boolean {
  const playhead = document.querySelector(
    '[data-testid="timeline-playhead"]'
  ) as HTMLElement | null;
  const endPoint = clientPointForTimelineTime(targetTimeSec);
  if (!playhead || !endPoint) {
    return false;
  }

  const startRect = playhead.getBoundingClientRect();
  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top + startRect.height / 2;

  playhead.dispatchEvent(
    new PointerEvent("pointerdown", pointerInit(startX, startY, 1))
  );
  const steps = 6;
  for (let step = 1; step <= steps; step += 1) {
    const ratio = step / steps;
    const clientX = startX + (endPoint.clientX - startX) * ratio;
    const clientY = startY + (endPoint.clientY - startY) * ratio;
    playhead.dispatchEvent(new PointerEvent("pointermove", pointerInit(clientX, clientY, 1)));
    window.dispatchEvent(new PointerEvent("pointermove", pointerInit(clientX, clientY, 1)));
  }
  window.dispatchEvent(
    new PointerEvent("pointerup", pointerInit(endPoint.clientX, endPoint.clientY, 0))
  );
  return true;
}
