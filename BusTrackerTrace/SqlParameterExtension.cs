using Microsoft.Data.SqlClient;

namespace BusTrackerServices
{
    public static class SqlParameterExtension
    {

        public static SqlParameter AddWithNullableValue(
            this SqlParameterCollection collection,
            string parameterName,
            object value)
        {
            if (value == null)
                return collection.AddWithValue(parameterName, DBNull.Value);
            else
                return collection.AddWithValue(parameterName, value);
        }
    }
}
