// Import utilities
import _ from 'underscore';
import 'girder/utilities/jquery/girderModal';
import { restRequest } from 'girder/rest';
import events from 'girder/events';
import { Status } from '../constants';
import { checkRequestError, messageGirder, getTimestamp } from '../utilities';
import 'bootstrap/js/button';

// Import views
import View from 'girder/views/View';

// Import templates
import ConfirmPipelineDialogTemplate from '../templates/confirmPipelineDialog.pug';

var ConfirmPipelineDialog = View.extend({

  initialize: function (settings) {
    this.file = settings.file;
    this.currentPipeline = settings.pipeline;
    this.foldersCollection = settings.foldersCollection;
    this.carmin = settings.carmin;
    this.pathVIP = "/vip/Home/Girder/";
    this.filesInput = [this.file._id];
    this.parameters = {};

    // Trie le tableau foldersCollection en fonction de "path"
    this.foldersCollection.sort(function(a, b){
      return a.path.localeCompare(b.path)
    });

    this.render();
  },

  events: {
    'submit .creatis-launch-pipeline-form' : 'initPipeline'
  },

  render: function () {
    $('#g-dialog-container').html(ConfirmPipelineDialogTemplate({
      pipeline: this.currentPipeline,
      file: this.file,
      folders: this.foldersCollection
    })).girderModal(this);

    $('a[data-toggle="tab"]').click(function () {
      $(this).css('background-color', 'transparent');
    });

    return this;
  },

  initPipeline: function (e) {
    e.preventDefault();

    var nameExecution = $('#name-execution');
    var folderGirderDestination = $('#selectFolderDestination');
    var checkArg = 1;

    if (!nameExecution.val() || !folderGirderDestination.val()) {
      $('#tab-general').css('background-color', '#e2181852');
      checkArg = 0;
    }
    else
      $('#tab-general').css('background-color', 'transparent');

    _.each(this.currentPipeline.parameters, function(param) {
      var e = $('#' + param.name)
      if (e.length > 0 && !e.val()) {// If the parameter exists in the DOM but is empty
        $('#tab-' + param.name).css('background-color', '#e2181852');
        checkArg = 0
      }
      else if (e.length > 0 && e.val())
        $('#tab-' + param.name).css('background-color', 'transparent');
    }.bind(this));

    if (!checkArg)
      return ;

    $('#run-pipeline').button('loading');

    var folderPath = this.pathVIP + "process-" + getTimestamp();

    // TODO Promise composition
    // Check if Girder folder exists
    this.carmin.fileExists(this.pathVIP).then(function (data) {
      if (!data.exists) {
        this.carmin.createFolder(this.pathVIP).then(function (data) {
          if (!checkRequestError(data)) {
            this.sendFile(folderPath);
          }
        }.bind(this));
      } else {
        this.sendFile(folderPath);
      }
    }.bind(this));
  },

  // TODO Promise composition
  sendFile: function (folderPath) {
    // Create folder to this process
    this.carmin.createFolder(folderPath).then(function (data) {
      if (!checkRequestError(data)) {
        // Send file into folder
        // TODO : fail function
        this.carmin.uploadData(folderPath + "/" + this.file.name, this.file.data).then(function (data) {
          if (!checkRequestError(data)) {
            this.launchPipeline(folderPath);
          }
        }.bind(this), function (error){
          console.log("Error: " + error);
          return;
        });
      }
    }.bind(this), function (data){
      console.log("Erreur: " + data);
    });
  },

  launchPipeline: function (folderPath) {
    var nameExecution = $('#name-execution').val();
    var folderGirderDestination = $('#selectFolderDestination').val();
    var sendMail = $('#send-email').is(':checked');
    var pathFileVIP = folderPath + "/" + this.file.name;

    // Fill paramaters
    _.each(this.currentPipeline.parameters, function(param) {
      if (param.name == "results-directory") {
        this.parameters[param.name] = folderPath;
      } else if (!(param.type == "File" && !param.defaultValue) && !param.defaultValue) { // condition bizarre à revoir
        this.parameters[param.name] = $('#'+param.name).val();
      } else if (param.type == 'File' && !param.defaultValue) {
        this.parameters[param.name] = folderPath + "/" + this.file.name;
      } else {
        this.parameters[param.name] = param.defaultValue;
      }
    }.bind(this));

    this.carmin.initAndStart(nameExecution, this.currentPipeline.identifier, this.parameters).then(function (data) {
      if (!checkRequestError(data)) {
        var filesInput = $.extend({}, this.filesInput);
        var params = {
          name: data.name,
          fileId: JSON.stringify(filesInput),
          pipelineName: this.currentPipeline.name,
          vipExecutionId: data.identifier,
          status: data.status.toUpperCase(),
          pathResultGirder: folderGirderDestination,
          childFolderResult: '',
          sendMail: sendMail,
          listFileResult: '{}',
          timestampFin: null,
          folderNameProcessVip: folderPath
        };

        restRequest({
          method: 'POST',
          url: 'pipeline_execution',
          data: params
        }).done(function (){
          $('#run-pipeline').button('reset');
          $('#g-dialog-container').find('a.close').click();
          messageGirder("success", "The execution is launched correctly", 3000);
        });
      }

    }.bind(this));
  }

});

export default ConfirmPipelineDialog;
