// Import utilities
import { wrap } from '@girder/core/utilities/PluginUtils';
import router from '@girder/core/router';
import { hasTheVipApiKeyConfigured, isPluginActivatedOn, messageGirder } from '../utilities/vipPluginUtils';

// Import views
import FileListWidget from '@girder/core/views/widgets/FileListWidget';
import ItemView from '@girder/core/views/body/ItemView';
import ListPipelinesWidget from './ListPipelinesWidget';
import ConfirmExecutionDialog from './ConfirmExecutionDialog';

// Import about Creatis
import ButtonLaunchPipeline from '../templates/buttonLaunchPipeline.pug';

// Ancestor : ItemView
wrap(FileListWidget, 'render', function(render) {
  render.call(this);

  this.showModal = this.parentView.showVipPipelines || this.parentView.showVipLaunch;
  if (! hasTheVipApiKeyConfigured() ){
    if (this.showModal) {
        this.onShowModalError('Your VIP API key is not configured in your girder account');
    }
    return this;
  }

  isPluginActivatedOn(this.parentItem)
  .then(isPluginActivated => {
    if (! this.canRenderVipPlugin(isPluginActivated)) return;

    this.collection.each(file => {
      this.$('li.g-file-list-entry .g-show-info[file-cid=' + file.cid + ']')
        .after(ButtonLaunchPipeline({model: file}));
    });

    if (this.parentView.showVipPipelines) {
      this.parentView.showVipPipelines = false;
      this.showPipelinesModal(this.parentView.vipPipelineFileId);
    }

    if (this.parentView.showVipLaunch) {
      this.parentView.showVipLaunch = false;
      this.showLaunchModal();
    }
  });

  return this;
});

// return true if render must be done
FileListWidget.prototype.canRenderVipPlugin = function (isPluginActivated) {
  if (! this.showModal) {
    return isPluginActivated;
  }

  // show modal requested
  var error;
  if ( ! isPluginActivated) {
    error = 'VIP applications cannot be used in this collection';
  } else if ( ! this.collection.get(this.parentView.vipPipelineFileId)) {
    error = 'You cannot launch a VIP pipeline on this file because it does not exist in this item';
  } else {
    // OK
    return true;
  }
  // there's an error

  this.onShowModalError(error);
  return false;

};

FileListWidget.prototype.onShowModalError = function (error) {
  this.showModal = false;
  this.parentView.showVipPipelines = false;
  this.parentView.showVipLaunch = false;
  messageGirder('danger', error);
  router.navigate(this.getRoute(), {replace: true});
};

FileListWidget.prototype.events['click a.vip-launch-pipeline'] = function (e) {
  var cid = $(e.currentTarget).attr('model-cid');
  this.showPipelinesModal(cid);
};

FileListWidget.prototype.getRoute = function () {
  return 'item/' + this.parentItem.id;
};

FileListWidget.prototype.showPipelinesModal = function (fileId) {
  new ListPipelinesWidget({
      el: $('#g-dialog-container'),
      file: this.collection.get(fileId),
      item: this.parentItem,
      parentView: this
  });
};

FileListWidget.prototype.showLaunchModal = function () {
    new ConfirmExecutionDialog({
      file: this.collection.get(this.parentView.vipPipelineFileId),
      item: this.parentItem,
      pipelineId: this.parentView.vipPipelineId,
      vipConfigOk : false,
      parentView: this,
      el: $('#g-dialog-container')
    });
};

wrap(ItemView, 'initialize', function(initialize, settings) {

  this.showVipPipelines = settings.showVipPipelines || false;
  this.showVipLaunch = settings.showVipLaunch || false;
  this.vipPipelineFileId = settings.vipPipelineFileId || false;
  this.vipPipelineId = settings.vipPipelineId || false;

  // Call the parent render
  initialize.call(this, settings);
});
