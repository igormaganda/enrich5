import React from 'react';
import { EnrichmentJobHistory } from '../components/EnrichmentJobHistory';

const EnrichmentPage: React.FC = () => {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Suivi des Enrichissements</h1>
      <EnrichmentJobHistory />
    </div>
  );
};

export default EnrichmentPage;
