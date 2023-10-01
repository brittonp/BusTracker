CREATE TABLE [dbo].[monitor_job]
(
	[Id] INT NOT NULL PRIMARY KEY identity(1,1), 
    [created] DATETIME NOT NULL DEFAULT getdate()
)
