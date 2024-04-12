CREATE TABLE [dbo].[bt_system_parameter]
(
	[name] VARCHAR(50) NOT NULL PRIMARY KEY,  
	[version] INTEGER NOT NULL DEFAULT 0,
    [created] DATETIME NOT NULL DEFAULT getdate(),
	[created_by] VARCHAR(50) NOT NULL DEFAULT 'UNKNOWN',
	[updated] DATETIME NOT NULL DEFAULT getdate(), 
	[updated_by] VARCHAR(50) NOT NULL DEFAULT 'UNKNOWN',
    [value] VARCHAR(200) NOT NULL
)
;