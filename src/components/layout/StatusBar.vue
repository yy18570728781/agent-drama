<template>
  <footer class="status-bar">
    <span class="status-dot"></span>
    <span>已连接</span>
    <span>·</span>
    <span>Vendor: 4/4 健康</span>
    <span class="spacer"></span>
    <span class="version">v0.1.0</span>
  </footer>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  height: 24px;
  padding: 0 16px;
  gap: 8px;
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-muted);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
}

.spacer { flex: 1; }
.version { color: var(--text-muted); }
</style>
