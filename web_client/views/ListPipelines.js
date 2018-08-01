//Import utilities
import _ from 'underscore';
import { restRequest } from 'girder/rest';
import { cancelRestRequests } from 'girder/rest';
import { confirm } from 'girder/dialog';
import { getCurrentUser } from 'girder/auth';
import events from 'girder/events';
import CarminClient from '../vendor/carmin/carmin-client';
import * as constants from '../constants';
import { getCurrentApiKeyVip, sortPipelines } from '../utilities';

// Import views
import View from 'girder/views/View';
import ConfirmPipelineDialog from './ConfirmPipelineDialog';

// Import templates
import ListPipelinesTemplate from '../templates/listPipelines.pug';

// List of pipelines allowed by the user
var ListPipelines = View.extend({
  initialize: function (settings) {
    cancelRestRequests('fetch');

    // Get api key of VIP
    var apiKeyVip = getCurrentApiKeyVip();
    if (apiKeyVip == null) {
      return ;
    }

    this.user = getCurrentUser();
    this.file = settings.file.responseJSON;
    this.foldersCollection = [];
    this.carmin = new CarminClient(constants.carminURL, apiKeyVip);

    // Get collection id
    restRequest({
      method: 'GET',
      url: 'item/' + this.file.itemId
    }).done((resp) => {
      this.collectionId = resp.baseParentId;
    });


    // Get pipelines of user
    this.carmin.listPipelines().then(function (data) {
      this.pipelines = sortPipelines(data);
      this.render();
    }.bind(this));

  },

  events: {
    'click .confirm-pipeline' : 'confirmPipeline'
  },

  render: function () {
    // Get folders of the collection
    //this.getFolderRecursively(this.collectionId, 0, "");

    // Get folders of the user
    this.getFolderRecursively(this.user.id, 0, "");

    this.$el.html(ListPipelinesTemplate({
      file: this.file,
      pipelines: this.pipelines,
    }));

    // User's view goes back up on top
    $("html, body").animate({scrollTop: 0}, "slow");

    return this;
  },

  /**
  * If the request to get details of pipeline has success
  * Create new instance of ConfirmPipelineDialog to
  * configure the launch of pipeline :
  *     - name of execution
  *     - result directory (stack results in girder)
  *     - checkbox to choose to send an email when the process is done
  *     - parameters of pipeline
  */
  confirmPipeline: function (e) {
    var pipelineIdentifier = $(e.currentTarget)[0].value;

    this.carmin.describePipeline(pipelineIdentifier).then(function (data) {
      if (typeof data.errorCode !== 'undefined') {
        events.trigger('g:alert', {
          text: "Unable to retrieve application informations for this version",
          type: "danger",
          duration: 3000
        });
      }
      else {
        new ConfirmPipelineDialog({
          file: this.file,
          pipeline: data,
          foldersCollection: this.foldersCollection,
          carmin: this.carmin,
          parentView: this,
          el: $('#g-dialog-container')
        });
      }
    }.bind(this));

  },

  /**
  * Get all folders from the current collection OR from the current user
  * To get the folder tree of a collection
  *   - Replace 'user' to 'collection' line 118
  *   - Uncommented line 59
  *   - Commented line 62
  * Conversely, to get the folder tree of the user (default)
  *   - Replace 'collection' to 'user' line 118
  *   - Uncommented line 62
  *   - Commented line 59
  */
  getFolderRecursively: function (parentId, i, path="") {
    var parentType = (i++ == 0) ? "user" : "folder";

    restRequest({
      method: "GET",
      url: "folder/",
      data: {
        parentType: parentType,
        parentId: parentId
      },
    }).done((resp) => {
      if (resp.length == 0) {
        return;
      }

      _.each(resp, function(e) {
        e.path = path.concat("/"+e.name);
        e.indent = i;
        e.indentText = "&nbsp;".repeat((i - 1) * 3);
        this.foldersCollection.push(e);
        this.getFolderRecursively(e._id, i, e.path);
      }.bind(this));
    });
  }

});

export default ListPipelines;
