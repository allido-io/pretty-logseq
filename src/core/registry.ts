import type { Feature } from '../types';

interface RegisteredFeature {
  feature: Feature;
  initialized: boolean;
}

export class FeatureRegistry {
  private features = new Map<string, RegisteredFeature>();
  private initOrder: string[] = [];

  register(feature: Feature): void {
    if (this.features.has(feature.id)) {
      console.warn(`[Pretty Logseq] Feature "${feature.id}" already registered`);
      return;
    }

    this.features.set(feature.id, {
      feature,
      initialized: false,
    });
  }

  get(id: string): Feature | undefined {
    return this.features.get(id)?.feature;
  }

  getAll(): Feature[] {
    return Array.from(this.features.values()).map(r => r.feature);
  }

  async initializeAll(): Promise<void> {
    for (const id of this.features.keys()) {
      await this.initializeFeature(id);
    }
  }

  async initializeFeature(id: string): Promise<void> {
    const registered = this.features.get(id);
    if (!registered) {
      console.warn(`[Pretty Logseq] Feature "${id}" not found`);
      return;
    }

    if (registered.initialized) return;

    try {
      await registered.feature.init();
      registered.initialized = true;
      this.initOrder.push(id);
      console.log(`[Pretty Logseq] Feature "${id}" initialized`);
    } catch (err) {
      console.error(`[Pretty Logseq] Failed to initialize feature "${id}":`, err);
    }
  }

  destroyFeature(id: string): void {
    const registered = this.features.get(id);
    if (!registered?.initialized) return;

    try {
      registered.feature.destroy();
      registered.initialized = false;
      this.initOrder = this.initOrder.filter(i => i !== id);
      console.log(`[Pretty Logseq] Feature "${id}" destroyed`);
    } catch (err) {
      console.error(`[Pretty Logseq] Failed to destroy feature "${id}":`, err);
    }
  }

  isInitialized(id: string): boolean {
    return this.features.get(id)?.initialized ?? false;
  }

  async destroyAll(): Promise<void> {
    // Tear down in reverse init order. Iterate a copy: destroyFeature prunes
    // initOrder as it goes.
    for (const id of [...this.initOrder].reverse()) {
      this.destroyFeature(id);
    }
    // A feature whose destroy() threw stays marked initialized but is dropped
    // from the order, matching the pre-refactor contract.
    this.initOrder = [];
  }

  getAggregatedStyles(): string {
    const styles: string[] = [];

    for (const registered of this.features.values()) {
      const featureStyles = registered.feature.getStyles();
      if (featureStyles) {
        styles.push(`/* Feature: ${registered.feature.id} */`);
        styles.push(featureStyles);
      }
    }

    return styles.join('\n\n');
  }
}

// Singleton instance
export const registry = new FeatureRegistry();
