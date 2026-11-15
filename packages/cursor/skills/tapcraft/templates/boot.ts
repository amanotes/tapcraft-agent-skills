import { _decorator, AudioSource, Component, director } from 'cc';
import { content } from '../scripts/hub/content';
import { platform } from '../scripts/hub/platform';
import { saves } from '../scripts/hub/saves';

const { ccclass } = _decorator;
const SAVE_SCHEMA = 1;

@ccclass('Boot')
export class Boot extends Component {
  private readonly pausedAudio = new Set<AudioSource>();

  async start(): Promise<void> {
    await platform.init();
    platform.firstFrameReady();
    this.scheduleOnce(() => platform.hidePlatformLoadingScreen(), 0);

    if (saves.schema < SAVE_SCHEMA) {
      // Migrate older saves before advancing the schema.
      saves.setSchema(SAVE_SCHEMA);
    }

    platform.onPause(() => {
      this.pausedAudio.clear();
      for (const source of this.node.scene?.getComponentsInChildren(AudioSource) ?? []) {
        if (!source.playing) continue;
        source.pause();
        this.pausedAudio.add(source);
      }
      director.pause();
    });
    platform.onResume(() => {
      director.resume();
      for (const source of this.pausedAudio) source.play();
      this.pausedAudio.clear();
    });

    const core = await content.load('core', { priority: 'critical' });
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
      platform.gameReady();
    });
  }
}
