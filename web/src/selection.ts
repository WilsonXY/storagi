export class Selection extends EventTarget {
  ids = new Set<string>();
  anchor: string | null = null;
  private drag?: { id: string; order: string[]; base: Set<string>; on: boolean };
  toggle(id: string, order: string[] = [], shift = false) {
    if (shift && this.anchor !== null) {
      const a = order.indexOf(this.anchor), b = order.indexOf(id);
      if (a >= 0 && b >= 0) {
        const on = !this.ids.has(id);
        for (const x of order.slice(Math.min(a, b), Math.max(a, b) + 1)) on ? this.ids.add(x) : this.ids.delete(x);
        this.emit(); return;
      }
    }
    this.ids.has(id) ? this.ids.delete(id) : this.ids.add(id); this.anchor = id; this.emit();
  }
  set(ids: Iterable<string>) { this.ids = new Set(ids); this.emit(); }
  clear() { this.ids.clear(); this.anchor = null; this.endDrag(); this.emit(); }
  allState(order: string[]): 'none' | 'some' | 'all' {
    const count = order.filter(id => this.ids.has(id)).length;
    return count === 0 ? 'none' : count === order.length ? 'all' : 'some';
  }
  beginDrag(id: string, order: string[]) {
    if (!order.includes(id)) return;
    this.drag = { id, order: [...order], base: new Set(this.ids), on: !this.ids.has(id) };
    this.anchor = id; this.dragTo(id);
  }
  dragTo(id: string) {
    const g = this.drag; if (!g) return;
    const a = g.order.indexOf(g.id), b = g.order.indexOf(id); if (b < 0) return;
    const ids = new Set(g.base);
    for (const x of g.order.slice(Math.min(a, b), Math.max(a, b) + 1)) g.on ? ids.add(x) : ids.delete(x);
    this.set(ids);
  }
  endDrag() { this.drag = undefined; }
  private emit() { this.dispatchEvent(new Event('change')); }
}
