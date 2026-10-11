import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { EmojiProvider } from './Emoji';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><EmojiProvider><App /></EmojiProvider></React.StrictMode>,
);
