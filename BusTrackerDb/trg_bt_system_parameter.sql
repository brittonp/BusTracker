CREATE TRIGGER [trg_system_parameter]
	ON [dbo].[bt_system_parameter]
	AFTER INSERT, UPDATE
	AS
	BEGIN
		INSERT INTO [dbo].[bt_system_parameter_audit]
		(
			[name],
			[version],
			[created],
			[created_by],
			[updated],
			[updated_by],
			[value]
		)
		SELECT
			i.[name],  
			i.[version],
			i.[created],
			i.[created_by],
			i.[updated],
			i.[updated_by],
			i.[value]
		FROM
			inserted i;
	END
	;
