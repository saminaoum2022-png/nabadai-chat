import {
  loadFabricJsIfNeeded,
  loadBackgroundRemovalIfNeeded,
  loadCocoSsd,
  loadTesseract
} from '/editor/loaders.js';
import {
  fetchCampaignEditorImage,
  fetchCampaignRewriteCopy
} from '/editor/network.js';
import {
  hideChatForEditorMode,
  restoreChatAfterEditorMode,
  makeRoundedRectPath,
  toHexColor
} from '/editor/layout.js';
import {
  buildCampaignPreviewCard
} from '/editor/editor-shell.js';
import {
  campaignBubbleHasActions,
  ensureCampaignTemplateStage,
  focusCampaignTextField,
  applyLogoToCampaignStage
} from '/editor/template.js';

export function createNabadEditorRuntime() {
  return {
    loadFabricJsIfNeeded,
    loadBackgroundRemovalIfNeeded,
    loadCocoSsd,
    loadTesseract,
    fetchCampaignEditorImage,
    fetchCampaignRewriteCopy,
    hideChatForEditorMode,
    restoreChatAfterEditorMode,
    makeRoundedRectPath,
    toHexColor,
    buildCampaignPreviewCard,
    campaignBubbleHasActions,
    ensureCampaignTemplateStage,
    focusCampaignTextField,
    applyLogoToCampaignStage
  };
}
