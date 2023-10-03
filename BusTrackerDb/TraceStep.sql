CREATE TABLE [dbo].[trace_step]
(
	[id] INT NOT NULL PRIMARY KEY identity(1,1), 
	[trace_id] INT NOT NULL, 
    [created] DATETIME NOT NULL DEFAULT getdate(),
    CONSTRAINT [FK_trace_step_trace_id_to_trace_job] FOREIGN KEY ([trace_id]) REFERENCES [dbo].[trace_job]([id]),
)

