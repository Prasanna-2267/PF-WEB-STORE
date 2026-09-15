import React from 'react';
import './powered-by-neuralweb-labs.css';

export const NEURALWEB_LABS_URL = 'https://neuralweblabs.com/';

export const PoweredByNeuralWebLabs: React.FC<{ className?: string }> = ({ className }) => (
  <a className={`pf-powered-brand${className ? ` ${className}` : ''}`} href={NEURALWEB_LABS_URL} target="_blank" rel="noopener noreferrer" aria-label="Powered by NeuralWeb Labs (opens in a new tab)">
    Powered by <strong>NeuralWeb Labs</strong>
  </a>
);
