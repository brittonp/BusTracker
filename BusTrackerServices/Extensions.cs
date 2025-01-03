using Microsoft.Data.SqlClient;

namespace BusTrackerServices
{
    public static class Extensions
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

        public static string Truncate(
            this string str,
            int maxLength)
        {
            return str[..Math.Min(maxLength, str.Length)];
        }
    }
}
