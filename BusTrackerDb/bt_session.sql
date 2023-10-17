CREATE TABLE [dbo].[bt_session]
(
	[id] INT NOT NULL PRIMARY KEY identity(1,1),     
    [created] DATETIME NOT NULL DEFAULT getdate(),
	[updated] DATETIME NOT NULL DEFAULT getdate(), 
    [event] VARCHAR(50) NOT NULL, 
    [header_query_string] VARCHAR(250) NULL, 
    [header_user_agent] VARCHAR(250) NULL, 
    [header_sec_ch_ua] VARCHAR(250) NULL
)
;

