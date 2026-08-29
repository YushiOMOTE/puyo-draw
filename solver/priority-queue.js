export class MaxPriorityQueue {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(value) {
    this.items.push(value);
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (!this.items.length) return null;
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    return first;
  }

  retainBest(limit) {
    if (this.items.length <= limit) return;
    this.items.sort((left, right) => right.priority - left.priority);
    this.items.length = limit;
    for (let index = Math.floor(this.items.length / 2); index >= 0; index--) {
      this.bubbleDown(index);
    }
  }

  bubbleUp(startIndex) {
    let index = startIndex;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].priority >= this.items[index].priority) break;
      [this.items[parent], this.items[index]] = [
        this.items[index],
        this.items[parent],
      ];
      index = parent;
    }
  }

  bubbleDown(startIndex) {
    let index = startIndex;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let best = index;

      if (
        left < this.items.length &&
        this.items[left].priority > this.items[best].priority
      ) {
        best = left;
      }
      if (
        right < this.items.length &&
        this.items[right].priority > this.items[best].priority
      ) {
        best = right;
      }
      if (best === index) break;
      [this.items[index], this.items[best]] = [
        this.items[best],
        this.items[index],
      ];
      index = best;
    }
  }
}
