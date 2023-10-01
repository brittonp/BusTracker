CREATE TABLE [dbo].[trace_job]
(
	[id] INT NOT NULL PRIMARY KEY identity(1,1), 
    [created] DATETIME NOT NULL DEFAULT getdate()
)

