/**
 * Build the ordered delivery-channel list from configuration (Req 14.1, 14.2).
 *
 * In-app is always present (delivery == persistence). Email and SMS are appended only when their
 * env toggles are enabled, using the mock/console adapters in local/dev.
 */

import type { Logger } from '@b2b/shared-node';
import { ConsoleEmailChannel, ConsoleSmsChannel, InAppChannel } from './adapters.js';
import type { Channel } from './types.js';

export interface ChannelToggles {
  emailEnabled: boolean;
  smsEnabled: boolean;
}

export function buildChannels(toggles: ChannelToggles, logger?: Logger): Channel[] {
  const channels: Channel[] = [new InAppChannel()];
  if (toggles.emailEnabled) channels.push(new ConsoleEmailChannel(logger));
  if (toggles.smsEnabled) channels.push(new ConsoleSmsChannel(logger));
  return channels;
}
