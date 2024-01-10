CREATE TABLE [dbo].[bt_system_parameter_audit]
(
	[audit_id] INT NOT NULL PRIMARY KEY identity(1,1),     
	[audit_timestamp] DATETIME NOT NULL DEFAULT getdate(),
	[name] VARCHAR(50),  
	[version] INTEGER,
    [created] DATETIME,
	[created_by] VARCHAR(50),
	[updated] DATETIME, 
	[updated_by] VARCHAR(50),
    [value] VARCHAR(200)
)
;
