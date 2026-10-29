import { generateItineraryDossierHTML, enrichPlanForDossier } from '../src/services/pdf.service.js';
import fs from 'fs';
import path from 'path';

async function testPdfGeneration() {
  console.log('[Test] Running PDF Dossier Generation with sample inputs...');

  const samplePlan = {
    title: 'Bangalore to Ooty Scenic Mountain Drive',
    origin: 'Bangalore, Karnataka',
    destination: 'Ooty, Tamil Nadu',
    totalDistanceKm: 275,
    totalDrivingHours: 5.5,
    members: 4,
    comfort: 'comfort',
    dining: 'family',
    fuelCost: 1980,
    tollCost: 380,
    stayCost: 6800,
    mealsCost: 3000,
    stops: [
      { name: 'Bangalore Central' },
      { name: 'Mysore Heritage Palace' },
      { name: 'Bandipur Tiger Reserve & Forest Corridor' },
      { name: 'Ooty Botanical Gardens & Doddabetta Peak' }
    ]
  };

  // 1. Enrich plan with deterministic fallback (no API key needed for deterministic test)
  const enriched = await enrichPlanForDossier(samplePlan, '');

  // 2. Generate publication-grade HTML
  const html = generateItineraryDossierHTML(samplePlan, enriched);

  const bodyContent = html.substring(html.indexOf('<body>'));
  const hasAsterisk = bodyContent.includes('**') || bodyContent.includes('*');
  const hasRouteSection = html.includes('Highway Corridor');
  const hasBudgetSection = html.includes('Budget Estimation');
  const hasPlacesSection = html.includes('Planned Places to Visit &amp; Optimal Viewing Timings');
  const hasRestaurantsSection = html.includes('Recommended Restaurants');
  const hasHotelsSection = html.includes('Curated Accommodations');
  const hasRecommendationsSection = html.includes('Essential Recommendations');
  const hasHeroImage = html.includes('https://images.unsplash.com');

  console.log('--- Verification Checklist ---');
  console.log('No Markdown Asterisks (*):', !hasAsterisk ? 'PASSED' : 'FAILED');
  console.log('1. Route Details Present:', hasRouteSection ? 'PASSED' : 'FAILED');
  console.log('2. Origin to Destination Present:', html.includes('Bangalore') && html.includes('Ooty') ? 'PASSED' : 'FAILED');
  console.log('3. Places & Optimal Timings Present:', hasPlacesSection ? 'PASSED' : 'FAILED');
  console.log('4. Restaurants Present:', hasRestaurantsSection ? 'PASSED' : 'FAILED');
  console.log('5. Hotels Present:', hasHotelsSection ? 'PASSED' : 'FAILED');
  console.log('6. Recommendations Present:', hasRecommendationsSection ? 'PASSED' : 'FAILED');
  console.log('Visual Hero Imagery Present:', hasHeroImage ? 'PASSED' : 'FAILED');

  const outputPath = path.resolve('docs/SAMPLE_ITINERARY_DOSSIER.html');
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`\n[Test] Generated sample HTML dossier saved to: ${outputPath}`);
}

testPdfGeneration().catch(console.error);
