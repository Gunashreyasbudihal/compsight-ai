import * as THREE from 'three';
import * as xb from 'xrblocks';
import { Competitor } from './types';
import { INITIAL_COMPETITORS } from './logic';

/**
 * 3D Spatial Competitive Intelligence Terminal built on XR Blocks (xb.Script).
 * Renders a 3D animated Emerald Radar Sweep mesh alongside manipulable
 * spatial UICards for the active competitor's Battlecard and Diff Timeline.
 */
export class CompSightSpatialScene extends xb.Script {
  private radarGroup?: THREE.Group;
  private radarSweepMesh?: THREE.Mesh;
  private blipMeshes: THREE.Mesh[] = [];
  private titleText?: xb.UIText;
  private domainText?: xb.UIText;
  private threatText?: xb.UIText;
  private strengthsText?: xb.UIText;
  private weaknessesText?: xb.UIText;
  private timelineText?: xb.UIText;
  private activeCompetitor: Competitor = INITIAL_COMPETITORS[0];
  private onSelectCallback?: (comp: Competitor) => void;
  private competitors: Competitor[] = [...INITIAL_COMPETITORS];

  constructor(onSelectCompetitor?: (comp: Competitor) => void) {
    super();
    this.onSelectCallback = onSelectCompetitor;
  }

  init() {
    this.add(new THREE.HemisphereLight(0xf1f5f9, 0x0b0d11, 2.8));
    const dirLight = new THREE.DirectionalLight(0x10b981, 2.2);
    dirLight.position.set(1.5, 3, 1.2);
    this.add(dirLight);

    this.buildRadarHologram();
    this.buildSpatialCards();
    this.syncCompetitor(this.activeCompetitor, this.competitors);
  }

  private buildRadarHologram() {
    this.radarGroup = new THREE.Group();
    this.radarGroup.position.set(0, 1.52, -1.25);

    // Outer obsidian disc
    const baseGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.012, 48);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0b0d11,
      roughness: 0.35,
      metalness: 0.6,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.rotation.x = Math.PI / 2;
    this.radarGroup.add(baseMesh);

    // Concentric emerald reticle rings
    const ringRadii = [0.26, 0.19, 0.12];
    ringRadii.forEach((radius, index) => {
      const ringGeo = new THREE.RingGeometry(radius - 0.004, radius, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: index === 0 ? 0.75 : 0.38,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.z = 0.008;
      this.radarGroup?.add(ring);
    });

    // C-Reticle arc matching CompSight logo
    const arcGeo = new THREE.RingGeometry(0.15, 0.185, 48, 1, 0.55, Math.PI * 1.65);
    const arcMat = new THREE.MeshBasicMaterial({
      color: 0xf1f5f9,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const arcMesh = new THREE.Mesh(arcGeo, arcMat);
    arcMesh.position.z = 0.01;
    this.radarGroup.add(arcMesh);

    // Center emerald core dot
    const coreGeo = new THREE.SphereGeometry(0.028, 24, 24);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.z = 0.012;
    this.radarGroup.add(coreMesh);

    // Rotating radar sweep sector
    const sweepGeo = new THREE.CircleGeometry(0.25, 32, 0, Math.PI / 3);
    const sweepMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.28,
    });
    this.radarSweepMesh = new THREE.Mesh(sweepGeo, sweepMat);
    this.radarSweepMesh.position.z = 0.011;
    this.radarGroup.add(this.radarSweepMesh);

    // Target signal blips
    const blipCoords = [
      { x: 0.11, y: 0.09, color: 0x10b981 },
      { x: -0.14, y: 0.07, color: 0xf59e0b },
      { x: 0.08, y: -0.15, color: 0xef4444 },
    ];
    blipCoords.forEach((b) => {
      const blip = new THREE.Mesh(
        new THREE.SphereGeometry(0.011, 16, 16),
        new THREE.MeshBasicMaterial({ color: b.color }),
      );
      blip.position.set(b.x, b.y, 0.015);
      this.blipMeshes.push(blip);
      this.radarGroup?.add(blip);
    });

    this.add(this.radarGroup);
  }

  private buildSpatialCards() {
    this.titleText = new xb.UIText({
      text: 'CompSight Battlecard — Linear',
      style: { fontSize: 24, fontWeight: 'bold', color: '#f1f5f9' },
    });
    this.domainText = new xb.UIText({
      text: 'https://linear.app · 6 snapshots',
      style: { fontSize: 15, color: '#94a3b8' },
    });
    this.threatText = new xb.UIText({
      text: 'HIGH THREAT · LIVE TELEMETRY LOCK',
      style: { fontSize: 14, fontWeight: 'bold', color: '#10b981' },
    });
    this.strengthsText = new xb.UIText({
      text: '',
      style: {
        fontSize: 15,
        lineHeight: 1.35,
        color: '#d1fae5',
        whiteSpace: 'pre-line',
      },
    });
    this.weaknessesText = new xb.UIText({
      text: '',
      style: {
        fontSize: 15,
        lineHeight: 1.35,
        color: '#fecdd3',
        whiteSpace: 'pre-line',
      },
    });

    const battleCard = new xb.UICard({
      size: { width: 0.62, height: 'auto' },
      manipulation: true,
      edge: true,
      style: {
        flexDirection: 'column',
        gap: 12,
        padding: 20,
        backgroundColor: '#11141b',
        borderRadius: 16,
      },
      children: [
        this.titleText,
        this.domainText,
        this.threatText,
        new xb.UIText({
          text: 'STRENGTHS (DETECTED ADVANTAGES)',
          style: { fontSize: 14, fontWeight: 'bold', color: '#10b981' },
        }),
        this.strengthsText,
        new xb.UIText({
          text: 'WEAKNESSES (COMPETITIVE GAPS)',
          style: { fontSize: 14, fontWeight: 'bold', color: '#ef4444' },
        }),
        this.weaknessesText,
        new xb.UIPanel({
          style: { width: '100%', flexDirection: 'row', gap: 10 },
          children: [
            new xb.UIButton({
              label: 'Prev Rival',
              icon: 'arrow_back',
              style: { flexGrow: 1 },
              onClick: () => this.cycleCompetitor(-1),
            }),
            new xb.UIButton({
              label: 'Next Rival',
              icon: 'arrow_forward',
              style: { flexGrow: 1 },
              onClick: () => this.cycleCompetitor(1),
            }),
          ],
        }),
      ],
    });
    battleCard.position.set(-0.62, 1.42, -1.15);
    battleCard.rotation.y = 0.22;
    this.add(battleCard);

    this.timelineText = new xb.UIText({
      text: '',
      style: {
        fontSize: 15,
        lineHeight: 1.4,
        color: '#f1f5f9',
        whiteSpace: 'pre-line',
      },
    });

    const timelineCard = new xb.UICard({
      size: { width: 0.6, height: 'auto' },
      manipulation: true,
      edge: true,
      style: {
        flexDirection: 'column',
        gap: 12,
        padding: 20,
        backgroundColor: '#11141b',
        borderRadius: 16,
      },
      children: [
        new xb.UIText({
          text: 'Competitive Timeline (Snapshot A → B)',
          style: { fontSize: 22, fontWeight: 'bold', color: '#f1f5f9' },
        }),
        new xb.UIText({
          text: 'Real-time branching DOM, pricing & API diff nodes',
          style: { fontSize: 14, color: '#94a3b8' },
        }),
        this.timelineText,
      ],
    });
    timelineCard.position.set(0.62, 1.42, -1.15);
    timelineCard.rotation.y = -0.22;
    this.add(timelineCard);
  }

  private cycleCompetitor(delta: number) {
    if (this.competitors.length === 0) return;
    const currentIndex = this.competitors.findIndex(
      (c) => c.id === this.activeCompetitor.id,
    );
    const nextIndex =
      (Math.max(0, currentIndex) + delta + this.competitors.length) %
      this.competitors.length;
    const nextComp = this.competitors[nextIndex];
    this.syncCompetitor(nextComp, this.competitors);
    this.onSelectCallback?.(nextComp);
  }

  public syncCompetitor(competitor: Competitor, allCompetitors?: Competitor[]) {
    this.activeCompetitor = competitor;
    if (allCompetitors) {
      this.competitors = allCompetitors;
    }
    if (this.titleText) {
      this.titleText.text = `Battlecard — ${competitor.name}`;
    }
    if (this.domainText) {
      this.domainText.text = `${competitor.url} · ${competitor.snapshotsCount} snapshots · ${competitor.lastScannedAt}`;
    }
    if (this.threatText) {
      this.threatText.text = `${competitor.threatLevel.toUpperCase()} · ${competitor.scanProgress}% SCAN LOCK`;
    }
    if (this.strengthsText) {
      this.strengthsText.text = competitor.strengths
        .map((s) => `+ ${s}`)
        .join('\n');
    }
    if (this.weaknessesText) {
      this.weaknessesText.text = competitor.weaknesses
        .map((w) => `- ${w}`)
        .join('\n');
    }
    if (this.timelineText) {
      this.timelineText.text = competitor.timelineBranches
        .map((b) => `[${b.label}] ${b.detail} (${b.timestamp})`)
        .join('\n\n');
    }
  }

  update() {
    const dt = xb.getDeltaTime ? xb.getDeltaTime() : 0.016;
    if (this.radarSweepMesh) {
      this.radarSweepMesh.rotation.z -= dt * 1.4;
    }
  }
}
