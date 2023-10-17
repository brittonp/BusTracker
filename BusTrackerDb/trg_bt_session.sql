CREATE TRIGGER [trg_bt_session]
	ON [dbo].[bt_session]
	AFTER INSERT, UPDATE
	AS
	BEGIN
		INSERT INTO [dbo].[bt_session_audit]
		(
			[session_id],
			[created],
			[updated],
			[event],
			[header_query_string],
			[header_user_agent],
			[header_sec_ch_ua]
		)
		SELECT
			i.id,
			i.created,
			i.updated,
			i.[event],
			i.[header_query_string],
			i.[header_user_agent],
			i.[header_sec_ch_ua]
		FROM
			inserted i;
	END;
