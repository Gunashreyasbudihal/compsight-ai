import * as xb from 'xrblocks';
import { CompSightApiClient } from './api';
import { CompSightSpatialScene } from './spatialScene';
import { CompSightUI } from './ui';
import { Competitor } from './types';

let spatialScene: CompSightSpatialScene | null = null;
let xrInitialized = false;

async function ensureSpatialXrStarted(
  onSelectFromSpatial: (comp: Competitor) => void,
  activeCompetitor?: Competitor,
  allCompetitors?: Competitor[],
): Promise<void> {
  if (!spatialScene) {
    spatialScene = new CompSightSpatialScene(onSelectFromSpatial);
  }
  if (!xrInitialized) {
    xrInitialized = true;
    const options = new xb.Options();
    options.setAppTitle('CompSight Spatial Terminal');
    options.setAppDescription(
      'Obsidian 3D spatial competitive intelligence radar, battlecard & diff timeline.',
    );
    xb.add(spatialScene);
    await xb.init(options);
  }
  if (activeCompetitor) {
    spatialScene.syncCompetitor(activeCompetitor, allCompetitors);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('root');
  if (!root) return;

  const api = new CompSightApiClient();
  let latestActive: Competitor | undefined;
  let latestAll: Competitor[] | undefined;

  const appUi = new CompSightUI(root, api, {
    onCompetitorChange: (comp, all) => {
      latestActive = comp;
      latestAll = all;
      spatialScene?.syncCompetitor(comp, all);
    },
    onToggleXR: (active) => {
      if (active) {
        void ensureSpatialXrStarted(
          (comp) => appUi.selectCompetitorFromExternal(comp),
          latestActive,
          latestAll,
        );
      }
    },
  });

  await appUi.init();

  const params = new URLSearchParams(window.location.search);
  if (params.get('xr') === '1') {
    await ensureSpatialXrStarted(
      (comp) => appUi.selectCompetitorFromExternal(comp),
      latestActive,
      latestAll,
    );
  }
});
