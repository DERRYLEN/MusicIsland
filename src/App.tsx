import React from 'react';
import { DynamicIsland } from './components/DynamicIsland';
import './App.css';

export const App: React.FC = () => {
  return (
    <main className="app-container">
      <DynamicIsland />
    </main>
  );
};

export default App;
