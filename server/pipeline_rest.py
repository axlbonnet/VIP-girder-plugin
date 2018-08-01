from girder.api.rest import Resource, filtermodel
from girder import logger
from girder.api import access
from girder.api.describe import Description, autoDescribeRoute
from girder.constants import AccessType
from .models.pipeline import PipelineExecution as PipelineExecutionModel
import json

# Create new route pipeline_execution
class PipelineExecution(Resource):
    def __init__(self):
        super(PipelineExecution, self).__init__()
        self.resourceName = 'pipeline_execution' # Name of the collection in the bdd
        self.model = PipelineExecutionModel()

        self.route('GET', (), self.get)
        self.route('GET', (':id',), self.getById)
        self.route('POST', (), self.createProcess)
        self.route('PUT', (':id', 'status'), self.setStatus)
        self.route('DELETE', (':id',), self.deleteProcess)

    @access.public
    @autoDescribeRoute(
	Description("Get all process")
    )
    def get(self):
        list = []
        for pipeline in self.model.get():
            list.append(pipeline)

        return list

    @access.public
    @autoDescribeRoute(
    Description("Get an execution by id")
    .modelParam('id', 'The ID of the execution', model=PipelineExecutionModel,
    destName='pipelineExecution')
    .errorResponse('ID was invalid')
    )
    def getById(self, pipelineExecution):
        return pipelineExecution

    @access.public
    @autoDescribeRoute(
    Description("Insert a new execution of pipeline")
    .param('name', 'Name of execution', strip=True)
    .jsonParam('fileId', 'IDs of the files that are processed', requireObject=True)
    .param('pipelineName', 'Name of pipeline launched', strip=True)
    .param('vipExecutionId', 'ID of the exection on VIP')
    .param('idFolderResult', 'The folder id where the results are stored')
    .param('status', 'Status of execution', default='null')
    .param('sendMail', 'Send an email when the execution has finished', dataType='boolean', default=False)
    .jsonParam('listFileResult', 'List of the files of result', requireObject=True)
    .param('timestampFin', 'Date of end of pipeline', required=False)
    )
    def createProcess(self, params):
        return self.model.createProcess(params, self.getCurrentUser())

    @access.public
    @autoDescribeRoute(
       Description("Set status of exection")
       .modelParam('id', 'The ID of the execution', model=PipelineExecutionModel, destName='pipelineExecution')
       .param('status', 'The new status')
    )
    def setStatus(self, pipelineExecution, status):
        self.model.setStatus(pipelineExecution, status)
        return {'message': 'Status was changed'}

    # TODO Ajouter dans modelParam un argument level=AccessType.ADMIN
    # Pour controller les acces, etendre le model a AccessControlledModel
    @access.public
    @autoDescribeRoute(
    Description("Delete an execution of pipeline")
    .modelParam('id', 'The ID of the execution to delete', model=PipelineExecutionModel,
    destName='pipelineExecution')
    )
    def deleteProcess(self, pipelineExecution):
        self.model.remove(pipelineExecution)
        return {'message': 'Deleted execution %s.' % pipelineExecution['name']}
