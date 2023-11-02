CREATE TABLE [dbo].[trace_data]
(
	[id] INT NOT NULL PRIMARY KEY identity(1,1),     
    [created] DATETIME NOT NULL DEFAULT getdate(),
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
    [location_longitude] DECIMAL(18, 6) NULL
)

