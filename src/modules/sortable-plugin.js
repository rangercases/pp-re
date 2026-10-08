// Tích hợp Swap Plugin cho SortableJS để hỗ trợ hoán đổi 1-1 giữa 2 ô ảnh
    (function() {
      if (typeof Sortable === 'undefined' || typeof Sortable.mount !== 'function') return;
      var lastSwapEl = null;
      function toggleClass(el, name, state) {
        if (!el || !name) return;
        if (el.classList) el.classList[state ? 'add' : 'remove'](name);
        else el.className = (' ' + el.className + ' ').replace(new RegExp(' ' + name + ' ', 'g'), ' ').trim() + (state ? ' ' + name : '');
      }
      function getIndex(el) {
        if (!el || !el.parentNode) return -1;
        var children = el.parentNode.children;
        for (var i = 0; i < children.length; i++) {
          if (children[i] === el) return i;
        }
        return -1;
      }
      function swapNodes(n1, n2) {
        var p1 = n1.parentNode, p2 = n2.parentNode;
        if (!p1 || !p2 || p1 === n2 || p2 === n1) return;
        var i1 = getIndex(n1), i2 = getIndex(n2);
        if (p1 === p2 && i1 < i2) i2++;
        p1.insertBefore(n2, p1.children[i1]);
        p2.insertBefore(n1, p2.children[i2]);
      }
      function SwapPlugin() {
        function Swap() {
          this.defaults = { swapClass: 'sortable-swap-highlight' };
        }
        Swap.prototype = {
          dragStart: function(_ref) {
            lastSwapEl = _ref.dragEl;
          },
          dragOverValid: function(_ref2) {
            var target = _ref2.target,
                onMove = _ref2.onMove,
                activeSortable = _ref2.activeSortable,
                changed = _ref2.changed,
                completed = _ref2.completed,
                cancel = _ref2.cancel;
            if (!activeSortable.options.swap) return;
            var el = this.sortable.el,
                options = this.options;
            var dragItem = target && target.closest ? target.closest(activeSortable.options.draggable || '*') : target;
            if (dragItem && dragItem !== el && (!activeSortable.options.draggable || (dragItem.matches && dragItem.matches(activeSortable.options.draggable)))) {
              var prevSwapEl = lastSwapEl;
              if (onMove(dragItem) !== false) {
                if (options.swapClass) toggleClass(dragItem, options.swapClass, true);
                lastSwapEl = dragItem;
              } else {
                lastSwapEl = null;
              }
              if (prevSwapEl && prevSwapEl !== lastSwapEl) {
                if (options.swapClass) toggleClass(prevSwapEl, options.swapClass, false);
              }
            }
            changed();
            completed(true);
            cancel();
          },
          drop: function(_ref3) {
            var activeSortable = _ref3.activeSortable,
                putSortable = _ref3.putSortable,
                dragEl = _ref3.dragEl;
            var toSortable = putSortable || this.sortable;
            var options = this.options;
            if (lastSwapEl && options.swapClass) toggleClass(lastSwapEl, options.swapClass, false);
            if (lastSwapEl && (options.swap || (putSortable && putSortable.options.swap))) {
              if (dragEl !== lastSwapEl) {
                if (toSortable.captureAnimationState) toSortable.captureAnimationState();
                if (toSortable !== activeSortable && activeSortable.captureAnimationState) activeSortable.captureAnimationState();
                swapNodes(dragEl, lastSwapEl);
                if (toSortable.animateAll) toSortable.animateAll();
                if (toSortable !== activeSortable && activeSortable.animateAll) activeSortable.animateAll();
              }
            }
          },
          nulling: function() {
            lastSwapEl = null;
          }
        };
        return Object.assign(Swap, {
          pluginName: 'swap',
          eventProperties: function() {
            return { swapItem: lastSwapEl };
          }
        });
      }
      try {
        Sortable.mount(new SwapPlugin());
      } catch (e) {
        console.warn('Sortable SwapPlugin mount error:', e);
      }
    })();
