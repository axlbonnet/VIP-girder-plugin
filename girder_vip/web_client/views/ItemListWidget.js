// Import utilities
import { wrap } from '@girder/core/utilities/PluginUtils';
import { AccessType } from '@girder/core/constants';
import router from '@girder/core/router';
import FileCollection from '@girder/core/collections/FileCollection';
import { hasTheVipApiKeyConfigured, isPluginActivatedOn, messageGirder } from '../utilities/vipPluginUtils';
import { confirm } from '@girder/core/dialog';

// Import views
import ItemListWidget from '@girder/core/views/widgets/ItemListWidget';
import ListPipelinesWidget from './ListPipelinesWidget';
import FolderView from '@girder/core/views/body/FolderView';
import CollectionView from '@girder/core/views/body/CollectionView';
import ConfirmExecutionDialog from './ConfirmExecutionDialog';

// Import Templates
import ButtonLaunchPipeline from '../templates/buttonLaunchPipeline.pug';

// Ancestors : CollectionView or FolderView > HierarchyWidget
wrap(ItemListWidget, 'render', function(render) {
  render.call(this);

  // there is a bug, there's a first render before the item collection is loaded
  if (! this.passageNumber) {
    this.passageNumber = 1;
    return this;
  }

  // parentView is a HierarchyView
  if ( ! this.canRenderVipPlugin(this.parentView.parentModel)) {
    return this;
  }

  this.collection.chain()
  .filter(item => item.get('_accessLevel') >= AccessType.READ)
  .each(item => {
    var itemNameEl =
      this.$('li.g-item-list-entry a.g-item-list-link[g-item-cid = ' + item.cid +  ']');
    if (this._viewLinks) {
      itemNameEl.siblings('.g-item-size')
        .before(ButtonLaunchPipeline({model: item}));
    } else {
      itemNameEl.parent()
        .append(ButtonLaunchPipeline({model: item}));
    }
  });

  if (this.parentView.parentView.showVipPipelines ||
          this.parentView.parentView.showVipLaunch) {
    var itemId = this.parentView.parentView.vipPipelineItemId;
    this.fetchFilesForItem(this.collection.get(itemId));
  }

  return this;
});

// return true if render must be done
ItemListWidget.prototype.canRenderVipPlugin = function (model) {
  var showModal = this.parentView.parentView.showVipPipelines || this.parentView.parentView.showVipLaunch;
  var isApiKeyOk = hasTheVipApiKeyConfigured();
  var isPluginActivated = isPluginActivatedOn(model);

  if (!showModal) {
    return isApiKeyOk && isPluginActivated;
  }

  // show modal requested
  var error;
  if ( ! isApiKeyOk) {
    error = 'Your VIP API key is not configured in your girder account';
  } else if ( ! isPluginActivated) {
    error = 'VIP applications cannot be used in this collection';
  } else if ( ! this.collection.get(this.parentView.parentView.vipPipelineItemId)) {
    error = 'You cannot launch a VIP pipeline on this item because it does not exist in this folder';
  } else {
    // OK but we must still check that the file requested is the only file of this item
    return true;
  }
  // there's an error

  this.parentView.parentView.showVipPipelines = false;
  this.parentView.parentView.showVipLaunch = false;
  messageGirder('danger', error);
  router.navigate(this.getRoute(), {replace: true});
  return false;

};

ItemListWidget.prototype.getRoute = function () {
  var route = 'folder/' + this.parentView.parentModel.id;
  if (this.parentView.parentView instanceof CollectionView) {
    route = 'collection/' + this.parentView.parentView.model.id + '/' + route;
  }
  return route;
};

ItemListWidget.prototype.events['click a.vip-launch-pipeline'] = function (e) {
  var cid = $(e.currentTarget).attr('model-cid');
  this.fetchFilesForItem(this.collection.get(cid));
};

ItemListWidget.prototype.fetchFilesForItem = function (item) {
  this.itemToLaunch = item;
  // fetch item files
  this.itemFiles = new FileCollection();
  this.itemFiles.altUrl = 'item/' + this.itemToLaunch.id + '/files';
  this.itemFiles.append = true; // Append, don't replace pages
  this.itemFiles
    .on('g:changed', () => this.onItemFilesReceived())
    .fetch();
};

ItemListWidget.prototype.onItemFilesReceived = function () {
  // is there a requested modal ?
  if (this.parentView.parentView.showVipPipeline ||
          this.parentView.parentView.showVipLaunch) {
    var showVipPipelines = this.parentView.parentView.showVipPipelines;
    this.parentView.parentView.showVipPipelines = false;
    this.parentView.parentView.showVipLaunch = false;

    var file = this.itemFiles.get(this.parentView.parentView.vipPipelineFileId);
    if ( ! file) {
      messageGirder('danger', 'You cannot launch a VIP pipeline on this file because it does not exist in this item');
      router.navigate(this.getRoute(), {replace: true});
    } else if (showVipPipelines) {
      this.showPipelinesModal(file)
    } else {
      this.showLaunchModal(file)
    }
    return;
  }

  if (this.itemFiles.length === 0) {
    messageGirder("warning", "VIP can not launch a pipeline on this item because it does not have any file")
  } else if (this.itemFiles.length > 1) {
    this.showConfirmModal();
  } else {
    var file = this.itemFiles.pop();
    this.showPipelinesModal(file);
  }

};

ItemListWidget.prototype.showConfirmModal = function (file) {
  var params = {
    text: 'This item has several files. Do you want to see the file list to launch a VIP pipeline on any of them ?',
    yesText: 'OK',
    yesClass: 'btn-primary',
    confirmCallback: () => router.navigate('item/' + this.itemToLaunch.id, {trigger : true})

  };
  confirm(params);
};

ItemListWidget.prototype.showPipelinesModal = function (file) {
  new ListPipelinesWidget({
      el: $('#g-dialog-container'),
      file: file,
      item: this.itemToLaunch,
      parentView: this
  });
};

ItemListWidget.prototype.showLaunchModal = function (file) {
  new ConfirmExecutionDialog({
    el: $('#g-dialog-container'),
    file: file,
    item: this.itemToLaunch,
    pipelineId: this.parentView.parentView.vipPipelineId,
    vipConfigOk : false,
    parentView: this,
  });
};

wrap(CollectionView, 'initialize', function(initialize, settings) {

  this.showVipPipelines = settings.showVipPipelines || false;
  this.showVipLaunch = settings.showVipLaunch || false;
  this.vipPipelineItemId = settings.vipPipelineItemId || false;
  this.vipPipelineFileId = settings.vipPipelineFileId || false;
  this.vipPipelineId = settings.vipPipelineId || false;

  // Call the parent render
  initialize.call(this, settings);
});


wrap(FolderView, 'initialize', function(initialize, settings) {

  this.showVipPipelines = settings.showVipPipelines || false;
  this.showVipLaunch = settings.showVipLaunch || false;
  this.vipPipelineItemId = settings.vipPipelineItemId || false;
  this.vipPipelineFileId = settings.vipPipelineFileId || false;
  this.vipPipelineId = settings.vipPipelineId || false;

  // Call the parent render
  initialize.call(this, settings);
});
