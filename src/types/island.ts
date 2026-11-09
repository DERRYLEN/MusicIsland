import React from 'react';

export type IslandModuleId = 'music' | 'timer' | 'system' | 'overboost' | string;

export interface IslandModuleContext {
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}

export interface IslandModule {
  id: IslandModuleId;
  name: string;
  renderCompact: (context: IslandModuleContext) => React.ReactNode;
  renderExpanded: (context: IslandModuleContext) => React.ReactNode;
}
