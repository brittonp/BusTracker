CREATE TABLE [dbo].[trace_job]
(
	[id] INT NOT NULL PRIMARY KEY identity(1,1), 
    [status] VARCHAR(50) NOT NULL , 
    [primary_thread] INT NOT NULL,
    [task_thread] INT,
    [created] DATETIME NOT NULL DEFAULT getdate(), 
    [updated] DATETIME NOT NULL DEFAULT getdate()
)


