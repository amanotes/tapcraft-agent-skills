// Boot component model for the Tapcraft SDK (kit 2.0): same call order as the kit's starter Boot.ts.
// `../tapcraft` is assets/tapcraft/, written by `tapcraft sync`; never edit it.
import { _decorator, AudioSource, Component, director } from 'cc';
import { Tapcraft } from '../tapcraft/index';

const { ccclass } = _decorator;
const SAVE_SCHEMA = 1;

interface Progress {
  best: number;
}

@ccclass('Boot')
export class Boot extends Component {
  private readonly pausedAudio = new Set<AudioSource>();
  private offPause: (() => void) | null = null;
  private offResume: (() => void) | null = null;
  progress: Progress = { best: 0 };

  override async start(): Promise<void> {
    await Tapcraft.init(); // loads saves, wires lifecycle; never rejects
    Tapcraft.lifecycle.firstFrameReady(); // the small local loading UI is drawn
    this.scheduleOnce(() => Tapcraft.lifecycle.hidePlatformLoadingScreen(), 0);

    if (Tapcraft.storage.schema < SAVE_SCHEMA) {
      // Migrate older saves here, then advance the schema.
      Tapcraft.storage.setSchema(SAVE_SCHEMA);
    }
    this.progress = Tapcraft.storage.getJson<Progress>('progress', { best: 0 });

    // Every pause reason (hubMenu, background, ad, exit, system): stop gameplay, timers and all audio.
    this.offPause = Tapcraft.lifecycle.onPause(() => {
      this.pausedAudio.clear();
      for (const source of this.node.scene?.getComponentsInChildren(AudioSource) ?? []) {
        if (!source.playing) continue;
        source.pause();
        this.pausedAudio.add(source);
      }
      director.pause();
    });
    this.offResume = Tapcraft.lifecycle.onResume(() => {
      director.resume();
      for (const source of this.pausedAudio) source.play();
      this.pausedAudio.clear();
    });

    const core = await Tapcraft.content.load('core', { priority: 'critical' });
    if (!core.ok) {
      console.error('[boot] local core bundle failed', core.reason);
      return;
    }

    core.bundle.loadScene('menu', (error, scene) => {
      if (error || !scene) {
        console.error('[boot] menu scene failed', error);
        return;
      }
      director.runScene(scene);
      Tapcraft.lifecycle.gameReady(); // when the menu accepts input
    });
  }

  override onDestroy(): void {
    this.offPause?.();
    this.offResume?.();
  }

  /** Call when a new best is reached: milestone, so wait for the native commit. */
  async saveBest(score: number): Promise<void> {
    if (score <= this.progress.best) return;
    this.progress = { best: score };
    Tapcraft.storage.setJson('progress', this.progress);
    await Tapcraft.storage.flush(); // { status: 'flushed' | 'unavailable' | 'error' }; never rejects
  }
}
