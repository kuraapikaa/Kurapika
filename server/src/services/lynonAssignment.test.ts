import { describe, expect, it } from 'vitest';
import { buildLynonAssignmentBlocks, buildLynonCampaignAssignmentBody } from './lynonBackofficeService.js';
import { assignmentValuesForPromoSpec } from './rulesService.js';

const template65 = {
  id: 65,
  templateBlocks: [{
    templateBlockKey: 'af37a5b4-2c88-4121-a839-b74e5ed24e60',
    blockId: 18,
    templateBlockName: 'F: Process FreeSpin',
    params: [
      { blockParamKey: 'BetLevel', blockParamType: 'integer', blockParamIsOptional: false, filledBy: 'assignment' },
      { blockParamKey: 'RoundCount', blockParamType: 'integer', blockParamIsOptional: false, filledBy: 'assignment' },
      { blockParamKey: 'Game', blockParamType: 'singleGameSelect', blockParamIsOptional: false, filledBy: 'assignment' },
    ],
  }],
};

describe('Lynon Freespin CampaignAssignment', () => {
  it('bonus kuralını canlı Lynon alanlarına dönüştürür', () => {
    expect(assignmentValuesForPromoSpec({
      freespinBetLevel: 1,
      freespinCount: 1,
      freespinGameId: 195202,
      freespinGameProviderId: 1,
    })).toEqual({ BetLevel: 1, RoundCount: 1, Game: { id: 195202, providerId: 1 } });
  });

  it('template 65 bloklarını backoffice isteğiyle birebir üretir', () => {
    const prepared = buildLynonAssignmentBlocks(template65, {
      BetLevel: 1,
      RoundCount: 1,
      Game: { id: 195202, providerId: 1 },
    });
    expect(prepared.missing).toEqual([]);
    expect(prepared.blocks).toEqual([{
      blockId: 18,
      params: [
        { blockParamKey: 'BetLevel', value: 1, valueJson: '1' },
        { blockParamKey: 'RoundCount', value: 1, valueJson: '1' },
        { blockParamKey: 'Game', value: { id: 195202, providerId: 1 }, valueJson: '{"Id":195202,"ProviderId":1}' },
      ],
      templateBlockKey: 'af37a5b4-2c88-4121-a839-b74e5ed24e60',
    }]);
  });

  it('configurationCurrency alanını CampaignAssignment gövdesine ekler', () => {
    const blocks = { '1655': buildLynonAssignmentBlocks(template65, { BetLevel: 1, RoundCount: 1, Game: { id: 195202, providerId: 1 } }).blocks };
    expect(buildLynonCampaignAssignmentBody({ campaignId: 1849, playerId: 2462987, assignmentReason: '1', configurationCurrency: 'TRY' }, blocks)).toEqual({
      campaignId: 1849,
      assignmentReason: '1',
      bonusBlocksConfiguration: blocks,
      configurationCurrency: 'TRY',
    });
  });
});