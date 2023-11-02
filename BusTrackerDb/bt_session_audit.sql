CREATE TABLE [dbo].[bt_session_audit]
(
	[audit_id] INT NOT NULL PRIMARY KEY identity(1,1),     
	[audit_timestamp] DATETIME NOT NULL DEFAULT getdate(),
	[session_id] INT NOT NULL,
    [created] DATETIME NOT NULL,
	[updated] DATETIME NOT NULL, 
    [event] VARCHAR(50) NOT NULL, 
    [header_query_string] VARCHAR(250) NULL, 
    [header_user_agent] VARCHAR(250) NULL, 
    [header_sec_ch_ua] VARCHAR(250) NULL
    CONSTRAINT [FK_sess_adt_session_id_sess] FOREIGN KEY ([session_id]) REFERENCES [bt_session]([id])
);

