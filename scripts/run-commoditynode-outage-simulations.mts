import {
  COMMODITYNODE_DEPENDENCIES,
  simulateCommodityNodeOutage,
} from '../shared/commoditynode-resilience';

const simulations = COMMODITYNODE_DEPENDENCIES.map((dependency) =>
  simulateCommodityNodeOutage({
    scenario: `${dependency} unavailable`,
    failedDependencies: [dependency],
    verifiedGraphSnapshotAvailable: dependency === 'database',
  })
);

for (const simulation of simulations) {
  const affected = simulation.surfaces.filter((surface) => surface.state !== 'current');
  if (affected.length === 0) {
    throw new Error(`${simulation.scenario} did not degrade any surface`);
  }
  const research = simulation.surfaces.find((surface) => surface.id === 'research');
  if (research?.state !== 'current') {
    throw new Error(`${simulation.scenario} removed the static research fallback`);
  }
  if (!Object.values(simulation.invariants).every(Boolean)) {
    throw new Error(`${simulation.scenario} violated a fail-soft invariant`);
  }
}

process.stdout.write(`${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  result: 'pass',
  simulationCount: simulations.length,
  simulations,
}, null, 2)}\n`);
