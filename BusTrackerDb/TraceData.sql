CREATE TABLE [dbo].[trace_data]
(
	[id] INT NOT NULL PRIMARY KEY identity(1,1), 
    [trace_id] INT NOT NULL, 
    [trace_step_id] INT NOT NULL, 
    [recorded_at_time] DATETIME NOT NULL,
    [item_identifier] VARCHAR(50) NOT NULL,
    [valid_until] DATETIME NOT NULL,
    [operator_ref] VARCHAR(50) NOT NULL, 
    [line_ref] VARCHAR(20) NOT NULL,
    [vehicle_ref] VARCHAR(20) NOT NULL,
    [vehicle_journey_ref] VARCHAR(20) NOT NULL,
    [direction_ref] VARCHAR(20),
    [published_line_name] VARCHAR(20),
    [origin_ref] VARCHAR(20),
    [origin_name] VARCHAR(50),
    [destination_ref] VARCHAR(20),
    [destination_name] VARCHAR(50),
    [origin_aimed_departure_time] DATETIME,
    [location_latitude] DECIMAL(18, 6) NULL,
    [location_longitude] DECIMAL(18, 6) NULL,
    [created] DATETIME NOT NULL DEFAULT getdate(), 
    CONSTRAINT [FK_trace_data_trace_id_to_trace_job] FOREIGN KEY ([trace_id]) REFERENCES [dbo].[trace_job]([id]),
    CONSTRAINT [FK_trace_data_id_to_trace_step] FOREIGN KEY ([trace_step_id]) REFERENCES [dbo].[trace_step]([id])

)

